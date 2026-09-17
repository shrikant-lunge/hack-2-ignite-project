"""
Emergency Broadcast Email Service
Handles sending bulk emails to all registered users via SMTP.
Supports Gmail, Outlook, and other SMTP providers.
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Tuple
import os
from datetime import datetime
import firebase_admin
from firebase_admin import db as rtdb

class EmergencyBroadcastService:
    """
    Service for sending emergency broadcast emails to all users.
    
    SETUP INSTRUCTIONS FOR GMAIL:
    ==============================
    1. Enable 2-Factor Authentication on your Google account:
       - Go to myaccount.google.com/security
       - Enable 2-Step Verification
    
    2. Generate an App Password:
       - Go to myaccount.google.com/apppasswords
       - Select "Mail" and "Windows Computer" (or your device)
       - Google will generate a 16-character password
       - Copy this password (without spaces)
    
    3. Set environment variables:
       - BROADCAST_EMAIL=your-email@gmail.com
       - BROADCAST_PASSWORD=your-16-char-app-password (no spaces)
       - BROADCAST_SMTP_SERVER=smtp.gmail.com
       - BROADCAST_SMTP_PORT=587
    
   
    """
    
    def __init__(self):
        """Initialize SMTP configuration from environment variables."""
        self.smtp_server = os.getenv('BROADCAST_SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('BROADCAST_SMTP_PORT', 587))
        self.sender_email = os.getenv('BROADCAST_EMAIL')
        self.sender_password = os.getenv('BROADCAST_PASSWORD')
        self.sender_name = os.getenv('BROADCAST_SENDER_NAME', 'EcoStride Admin')
        
        if not self.sender_email or not self.sender_password:
            raise ValueError(
                "BROADCAST_EMAIL and BROADCAST_PASSWORD environment variables must be set. "
                "See docstring for setup instructions."
            )
    
    def get_all_user_emails(self) -> List[str]:
        """
        Fetch all user emails from Firebase Realtime Database.
        
        Returns:
            List of email addresses
        """
        try:
            users_ref = rtdb.reference('users')
            users_data = users_ref.get()
            
            if not users_data:
                return []
            
            emails = []
            for uid, user_data in users_data.items():
                if user_data and user_data.get('email'):
                    emails.append(user_data['email'])
            
            return emails
        except Exception as e:
            print(f"Error fetching user emails: {e}")
            raise
    
    def create_email_html(self, title: str, message: str) -> str:
        """
        Create a professional HTML email template.
        
        Args:
            title: Email subject/title
            message: Email body message
        
        Returns:
            HTML string for email body
        """
        # Convert plain text line breaks to HTML
        formatted_message = message.replace('\n', '<br>')
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    background-color: #f5f5f5;
                }}
                .email-container {{
                    max-width: 600px;
                    margin: 20px auto;
                    background-color: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                }}
                .email-header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                }}
                .email-header h1 {{
                    margin: 0;
                    font-size: 24px;
                    font-weight: 600;
                }}
                .email-body {{
                    padding: 30px;
                }}
                .email-title {{
                    color: #667eea;
                    font-size: 20px;
                    font-weight: 600;
                    margin-bottom: 15px;
                }}
                .email-content {{
                    color: #555;
                    font-size: 14px;
                    line-height: 1.8;
                    margin-bottom: 20px;
                }}
                .email-footer {{
                    background-color: #f9f9f9;
                    padding: 20px;
                    text-align: center;
                    font-size: 12px;
                    color: #999;
                    border-top: 1px solid #eee;
                }}
                .timestamp {{
                    font-size: 11px;
                    color: #bbb;
                    margin-top: 10px;
                }}
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="email-header">
                    <h1>🌍 EcoStride</h1>
                    <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">
                        Environmental Health & Safe Routing Platform
                    </p>
                </div>
                <div class="email-body">
                    <div class="email-title">{title}</div>
                    <div class="email-content">{formatted_message}</div>
                </div>
                <div class="email-footer">
                    <p style="margin: 0; color: #555;">
                        This is an official announcement from EcoStride Admin
                    </p>
                    <div class="timestamp">
                        Sent on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        return html
    
    def send_bulk_email(
        self,
        recipient_emails: List[str],
        title: str,
        message: str,
        cc_emails: List[str] = None,
        bcc_emails: List[str] = None,
        batch_size: int = 50
    ) -> Tuple[bool, Dict]:
        """
        Send email to multiple recipients in batches.
        
        Args:
            recipient_emails: List of recipient email addresses
            title: Email subject/title
            message: Email body message
            cc_emails: Optional list of CC email addresses
            bcc_emails: Optional list of BCC email addresses
            batch_size: Number of emails to send per batch (default 50)
        
        Returns:
            Tuple of (success: bool, stats: dict with sent/failed/total counts)
        """
        if not recipient_emails:
            return False, {"error": "No recipient emails provided", "sent": 0, "failed": 0, "total": 0}
        
        stats = {
            "total": len(recipient_emails),
            "sent": 0,
            "failed": 0,
            "errors": []
        }
        
        cc_emails = cc_emails or []
        bcc_emails = bcc_emails or []
        
        try:
            # Create HTML email body
            html_body = self.create_email_html(title, message)
            
            # Connect to SMTP server
            try:
                if self.smtp_port == 465:
                    # SSL connection (port 465)
                    server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port, timeout=10)
                else:
                    # TLS connection (port 587)
                    server = smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=10)
                    server.starttls()
                
                server.login(self.sender_email, self.sender_password)
            except smtplib.SMTPAuthenticationError:
                error_msg = "SMTP Authentication failed. Check BROADCAST_EMAIL and BROADCAST_PASSWORD."
                stats["errors"].append(error_msg)
                return False, stats
            except Exception as e:
                error_msg = f"SMTP connection error: {str(e)}"
                stats["errors"].append(error_msg)
                return False, stats
            
            # Process recipients in batches
            total_recipients = len(recipient_emails)
            for i in range(0, total_recipients, batch_size):
                batch = recipient_emails[i:i + batch_size]
                
                for recipient in batch:
                    try:
                        # Create email message
                        msg = MIMEMultipart('alternative')
                        msg['Subject'] = title
                        msg['From'] = f"{self.sender_name} <{self.sender_email}>"
                        msg['To'] = recipient
                        
                        if cc_emails:
                            msg['Cc'] = ', '.join(cc_emails)
                        
                        # Attach plain text and HTML versions
                        text_part = MIMEText(message, 'plain')
                        html_part = MIMEText(html_body, 'html')
                        msg.attach(text_part)
                        msg.attach(html_part)
                        
                        # Send email with all recipients
                        all_recipients = [recipient] + cc_emails + bcc_emails
                        server.sendmail(self.sender_email, all_recipients, msg.as_string())
                        
                        stats["sent"] += 1
                    
                    except Exception as e:
                        stats["failed"] += 1
                        stats["errors"].append(f"{recipient}: {str(e)}")
                        print(f"Failed to send to {recipient}: {e}")
            
            server.quit()
            return stats["failed"] == 0, stats
        
        except Exception as e:
            stats["errors"].append(f"Unexpected error: {str(e)}")
            return False, stats
    
    def send_broadcast_email(
        self,
        title: str,
        message: str,
        cc_emails: List[str] = None,
        bcc_emails: List[str] = None
    ) -> Tuple[bool, Dict]:
        """
        Send broadcast email to all registered users.
        
        Args:
            title: Email subject/title
            message: Email body message
            cc_emails: Optional list of CC email addresses
            bcc_emails: Optional list of BCC email addresses
        
        Returns:
            Tuple of (success: bool, stats: dict)
        """
        try:
            # Fetch all user emails
            recipient_emails = self.get_all_user_emails()
            
            if not recipient_emails:
                return False, {"error": "No users found in database", "sent": 0, "failed": 0, "total": 0}
            
            # Send bulk email
            return self.send_bulk_email(recipient_emails, title, message, cc_emails, bcc_emails)
        
        except Exception as e:
            error_msg = f"Failed to send broadcast: {str(e)}"
            print(error_msg)
            return False, {"error": error_msg, "sent": 0, "failed": 0, "total": 0}
