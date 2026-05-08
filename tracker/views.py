# tracker/views.py
import datetime
from django.shortcuts import render
from django.db.models import Sum
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import TimeEntry
from .serializers import TimeEntrySerializer


# ── Serve the single-page frontend ──────────────────────────────────────────
def index(request):
    return render(request, 'index.html')


# ── List or create a single entry ────────────────────────────────────────────
@api_view(['GET', 'POST'])
def entries(request):
    if request.method == 'GET':
        qs = TimeEntry.objects.all()
        if d := request.query_params.get('date'):
            qs = qs.filter(date=d)
        return Response(TimeEntrySerializer(qs, many=True).data)

    s = TimeEntrySerializer(data=request.data)
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data, status=201)


# ── Bulk upsert (offline sync) ────────────────────────────────────────────────
@api_view(['POST'])
def bulk_sync(request):
    synced_ids = []
    errors = []

    for item in request.data:
        s = TimeEntrySerializer(data=item)

        if s.is_valid():
            try:
                obj = TimeEntry.objects.filter(id=item['id']).first()

                if obj:
                    obj.date = s.validated_data['date']
                    obj.check_in = s.validated_data['check_in']
                    obj.check_out = s.validated_data['check_out']
                    obj.hours = s.validated_data['hours']
                    obj.note = s.validated_data.get('note', '')
                    obj.save()
                else:
                    data = s.validated_data.copy()
                    data['id'] = item['id']

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
                'errors': s.errors
            })

    return Response({
        'synced': synced_ids,
        'errors': errors
    })
# ── Aggregated summary ────────────────────────────────────────────────────────
@api_view(['GET'])
def summary(request):
    today       = datetime.date.today()
    week_start  = today - datetime.timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    def total(qs):
        result = qs.aggregate(h=Sum('hours'))['h']
        return float(result) if result else 0.0

    return Response({
        'day':   total(TimeEntry.objects.filter(date=today)),
        'week':  total(TimeEntry.objects.filter(date__gte=week_start)),
        'month': total(TimeEntry.objects.filter(date__gte=month_start)),
    })