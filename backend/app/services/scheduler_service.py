from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.jobs.alert_job import run_alert_check
from app.jobs.analysis_job import run_analysis
from app.jobs.maintenance_job import run_maintenance
from app.extensions import db
from app.models.base import Configuracion

scheduler = BackgroundScheduler(daemon=True)
JOB_ALERT = 'smartfill_alert'
JOB_ANALYSIS = 'smartfill_analysis'
JOB_MAINTENANCE = 'smartfill_maintenance'

DEFAULT_ALERT_INTERVAL = 3600
DEFAULT_ANALYSIS_INTERVAL = 86400
DEFAULT_MAINTENANCE_INTERVAL = 604800


def _read_interval(clave, default):
    try:
        conf = Configuracion.query.filter_by(clave=clave).first()
        return int(conf.valor) if conf else default
    except Exception:
        return default


def _init_jobs():
    alert_interval = _read_interval('alert_interval', DEFAULT_ALERT_INTERVAL)
    analysis_interval = _read_interval('analysis_interval', DEFAULT_ANALYSIS_INTERVAL)
    maintenance_interval = _read_interval('maintenance_interval', DEFAULT_MAINTENANCE_INTERVAL)

    scheduler.add_job(
        run_alert_check,
        IntervalTrigger(seconds=alert_interval),
        id=JOB_ALERT,
        replace_existing=True,
        next_run_time=None
    )
    scheduler.add_job(
        run_analysis,
        IntervalTrigger(seconds=analysis_interval),
        id=JOB_ANALYSIS,
        replace_existing=True,
        next_run_time=None
    )
    scheduler.add_job(
        run_maintenance,
        IntervalTrigger(seconds=maintenance_interval),
        id=JOB_MAINTENANCE,
        replace_existing=True,
        next_run_time=None
    )


def start_scheduler():
    if scheduler.running:
        return
    _init_jobs()
    scheduler.start()


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)


def get_scheduler_status():
    jobs = []
    for j in scheduler.get_jobs():
        jobs.append({
            'id': j.id,
            'next_run': j.next_run_time.isoformat() if j.next_run_time else None,
            'interval_seconds': j.trigger.interval_length if hasattr(j.trigger, 'interval_length') else None
        })
    return {
        'running': scheduler.running,
        'jobs': jobs
    }


def reschedule_job(job_id, interval_seconds):
    if not scheduler.running:
        return False
    job = scheduler.get_job(job_id)
    if not job:
        return False
    job.reschedule(IntervalTrigger(seconds=interval_seconds))
    return True
