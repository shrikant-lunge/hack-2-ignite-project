# run_setup.py - Run this once to initialize the system
import sqlite3
import os
import sys

def setup_database():
    """Create SQLite database and tables"""
    print("📦 Setting up database structures...")
    db_dir = os.path.join(os.path.dirname(__file__), 'database')
    os.makedirs(db_dir, exist_ok=True)
    db_path = os.path.join(db_dir, 'teamx.db')
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS aqi_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            location TEXT,
            latitude REAL,
            longitude REAL,
            aqi INTEGER,
            pm25 REAL,
            pm10 REAL,
            no2 REAL,
            so2 REAL,
            co REAL,
            o3 REAL
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE,
            age INTEGER,
            health_conditions TEXT,
            location TEXT,
            preferences TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pollution_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            latitude REAL,
            longitude REAL,
            source_type TEXT,
            confidence REAL,
            pollutants TEXT
        )
    ''')
    
    # Add basic indexes
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_location ON aqi_data(location)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON aqi_data(timestamp)')
    
    conn.commit()
    conn.close()
    print("✅ Database setup complete!")

def download_initial_data():
    """Download historical data for model training"""
    print("📥 Downloading initial training data... (Placeholder)")
    # We will implement this after the forecasting module is set up
    print("✅ Initial data configuration noted. Run the forecasting pipeline once active.")

def train_initial_model():
    """Train the forecasting model with initial data"""
    print("🤖 Training initial forecasting model... (Placeholder)")
    # We will implement this after the forecasting module is set up
    print("✅ Model training configuration noted.")

if __name__ == "__main__":
    print("🚀 Setting up Team-X Air Quality System (Free Version)...")
    setup_database()
    # Temporarily commenting these out until we build the respective modules
    # download_initial_data()
    # train_initial_model()
    print("\n✨ Setup complete! Run 'python app.py' to start the application.")
