# background_tasks.py
import time
import threading
import schedule
from models.forecasting import AQIForecaster
from services.alert_service import AQIAlertService

def start_background_tasks():
    print("🚀 Initializing background tasks...")
    
    alert_service = AQIAlertService()
    
    # Check AQI and send alerts every 30 minutes
    schedule.every(30).minutes.do(alert_service.check_and_send_alerts)
    
    def run_scheduler():
        while True:
            schedule.run_pending()
            time.sleep(60)
            
    thread = threading.Thread(target=run_scheduler, daemon=True)
    thread.start()
    print("🚀 Background tasks active and scheduling loop running!")
