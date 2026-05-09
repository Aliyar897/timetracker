# tracker/views.py
import datetime
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib.auth.decorators import login_required
from datetime import datetime
from .models import TimeEntry
from .serializers import TimeEntrySerializer

from datetime import date, timedelta


from decimal import Decimal
from django.shortcuts import render
from django.db.models import Sum
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

## For simplicity, auth views are included here, but in a real app they should be in a separate file.
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from .models import Profile, TimeEntry
from .serializers import TimeEntrySerializer


## signup view
def signup_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        hourly_rate = request.POST.get('hourly_rate')

        if User.objects.filter(username=username).exists():
            return render(request, 'signup.html', {
                'error': 'Username already exists'
            })

        user = User.objects.create_user(
            username=username,
            password=password
        )

        # ✅ profile now exists automatically
        user.profile.hourly_rate = hourly_rate
        user.profile.save()

        return redirect('login')

    return render(request, 'signup.html')

## login view
def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return redirect('index')

        return render(request, 'login.html', {
            'error': 'Invalid username or password'
        })

    return render(request, 'login.html')

## logout view
def logout_view(request):
    logout(request)
    return redirect('login')


# ── Serve the single-page frontend ──────────────────────────────────────────

@login_required(login_url='login')
def index(request):
    return render(request, 'index.html')


# ── List or create a single entry ────────────────────────────────────────────

@api_view(['GET', 'POST'])
@login_required
def entries(request):

    # ✅ GET: only MY entries
    if request.method == 'GET':
        qs = TimeEntry.objects.filter(user=request.user)

        if d := request.query_params.get('date'):
            qs = qs.filter(date=d)

        return Response(
            TimeEntrySerializer(qs, many=True).data
        )

    # ✅ POST: save entry for ME
    serializer = TimeEntrySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    serializer.save(user=request.user)   # ✅ attach owner

    return Response(serializer.data, status=status.HTTP_201_CREATED)


# ── Bulk upsert (offline sync) ────────────────────────────────────────────────
@api_view(['POST'])
@login_required
def bulk_sync(request):
    synced_ids = []
    errors = []

    for item in request.data:
        try:
            obj = TimeEntry.objects.filter(
                id=item['id'],
                user=request.user
            ).first()

            if obj:
                # ✅ UPDATE existing entry properly
                serializer = TimeEntrySerializer(
                    obj,
                    data=item,
                    partial=True
                )

            else:
                # ✅ CREATE new entry
                serializer = TimeEntrySerializer(data=item)

            if serializer.is_valid():
                serializer.save(user=request.user)
                synced_ids.append(item['id'])
            else:
                errors.append({
                    'id': item.get('id'),
                    'errors': serializer.errors
                })

        except Exception as e:
            errors.append({
                'id': item.get('id'),
                'error': str(e)
            })

    return Response({
        'synced': synced_ids,
        'errors': errors
    })

# ── Aggregated summary ────────────────────────────────────────────────────────
@api_view(['GET'])
@login_required
def summary(request):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    profile, _ = Profile.objects.get_or_create(
        user=request.user,
        defaults={'hourly_rate': 0}
    )
    rate = float(profile.hourly_rate)

    def total(qs):
        hours = qs.aggregate(h=Sum('hours'))['h'] or 0
        hours = float(hours)

        return {
            'hours': hours,
            'earnings': round(hours * rate, 2)
        }

    qs = TimeEntry.objects.filter(user=request.user)

    return Response({
        'rate': rate,  # ✅ 👈 ADD THIS
        'day': total(qs.filter(date=today)),
        'week': total(qs.filter(date__gte=week_start)),
        'month': total(qs.filter(date__gte=month_start)),
    })

@api_view(['DELETE'])
@login_required
def delete_entry(request, entry_id):
    try:
        obj = TimeEntry.objects.get(id=entry_id, user=request.user)
        obj.delete()
        return Response({"status": "deleted"})
    except TimeEntry.DoesNotExist:
        return Response({"error": "Not found"}, status=404)


@api_view(['GET'])
@login_required
def get_entries(request):
    qs = TimeEntry.objects.filter(user=request.user)

    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')

    print("Filtering entries from", start_date, "to", end_date)
    
    if start_date:
        start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        qs = qs.filter(date__gte=start_date)

    if end_date:
        end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        qs = qs.filter(date__lte=end_date)

    return Response(TimeEntrySerializer(qs, many=True).data)