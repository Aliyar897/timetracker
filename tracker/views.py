# tracker/views.py
import datetime
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
        serializer = TimeEntrySerializer(data=item)

        if serializer.is_valid():
            try:
                # ✅ ONLY look at entries belonging to THIS user
                obj = TimeEntry.objects.filter(
                    id=item['id'],
                    user=request.user
                ).first()

                if obj:
                    # ✅ update MY entry only
                    obj.date = serializer.validated_data['date']
                    obj.check_in = serializer.validated_data['check_in']
                    obj.check_out = serializer.validated_data['check_out']
                    obj.hours = serializer.validated_data['hours']
                    obj.note = serializer.validated_data.get('note', '')
                    obj.save()
                else:
                    # ✅ create a NEW entry owned by ME
                    data = serializer.validated_data.copy()
                    data['id'] = item['id']
                    data['user'] = request.user

                    TimeEntry.objects.create(**data)

                synced_ids.append(item['id'])

            except Exception as e:
                errors.append({
                    'id': item.get('id'),
                    'error': str(e)
                })
        else:
            errors.append({
                'id': item.get('id'),
                'errors': serializer.errors
            })

    return Response({
        'synced': synced_ids,
        'errors': errors
    })

# ── Aggregated summary ────────────────────────────────────────────────────────
@api_view(['GET'])
@login_required
def summary(request):
    today = datetime.date.today()
    week_start = today - datetime.timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    profile, _ = Profile.objects.get_or_create(
        user=request.user,
        defaults={'hourly_rate': Decimal('0.00')}
    )
    rate = profile.hourly_rate

    def total(qs):
        hours = qs.aggregate(h=Sum('hours'))['h'] or Decimal('0.00')
        earnings = (hours * rate).quantize(Decimal('0.01'))
        return {
            'hours': float(hours),
            'earnings': float(earnings)
        }

    qs = TimeEntry.objects.filter(user=request.user)

    return Response({
        'day': total(qs.filter(date=today)),
        'week': total(qs.filter(date__gte=week_start)),
        'month': total(qs.filter(date__gte=month_start)),
    })
