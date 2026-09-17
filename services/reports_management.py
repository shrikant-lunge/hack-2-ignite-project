"""
Reports Management Service
Handles community reports submitted by users (pollution, issues, etc.)
Supports both Firebase Realtime DB and local file storage fallback
"""

from typing import List, Dict, Tuple
from datetime import datetime
import firebase_admin
from firebase_admin import db as rtdb
import os
import json
from pathlib import Path

class ReportsManagementService:
    """Service for managing user-submitted reports"""
    
    def __init__(self):
        self.use_local_fallback = self._should_use_fallback()
        self.local_storage_path = None
        
        if self.use_local_fallback:
            from config import LOCAL_STORAGE_PATH
            self.local_storage_path = LOCAL_STORAGE_PATH
            Path(self.local_storage_path).mkdir(parents=True, exist_ok=True)
    
    def _should_use_fallback(self) -> bool:
        """Determine if we should use local fallback storage"""
        try:
            test_ref = rtdb.reference('.info/connected')
            test_ref.get()
            return False
        except:
            return True
    
    def _get_local_reports_file(self) -> str:
        """Get path to local reports storage file"""
        return os.path.join(self.local_storage_path, 'community_reports.json')
    
    def _read_local_reports(self) -> Dict:
        """Read reports from local file storage"""
        try:
            file_path = self._get_local_reports_file()
            if os.path.exists(file_path):
                with open(file_path, 'r') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            print(f"Error reading local reports: {e}")
            return {}
    
    def _write_local_reports(self, reports: Dict) -> bool:
        """Write reports to local file storage"""
        try:
            file_path = self._get_local_reports_file()
            with open(file_path, 'w') as f:
                json.dump(reports, f, indent=2)
            return True
        except Exception as e:
            print(f"Error writing local reports: {e}")
            return False
    
    def _generate_report_id(self) -> str:
        """Generate a unique report ID"""
        import uuid
        return str(uuid.uuid4())
        
    def create_report(self, report_type: str, description: str, city: str, lat: float, lon: float) -> Tuple[bool, Dict]:
        """Create a new community report"""
        try:
            new_report = {
                'type': report_type,
                'description': description,
                'city': city,
                'lat': lat,
                'lon': lon,
                'status': 'unresolved',
                'timestamp': datetime.now().isoformat()
            }
            
            if self.use_local_fallback:
                reports = self._read_local_reports()
                report_id = self._generate_report_id()
                reports[report_id] = new_report
                
                if self._write_local_reports(reports):
                    return True, {"reportId": report_id, "message": "Report saved locally", "storageType": "local"}
                else:
                    return False, {"error": "Failed to save report locally"}
            else:
                reports_ref = rtdb.reference('communityReports')
                result = reports_ref.push(new_report)
                report_id = result.key
                return True, {"reportId": report_id, "message": "Report saved to Firebase", "storageType": "firebase"}
        except Exception as e:
            print(f"Error creating report: {e}")
            if not self.use_local_fallback:
                print("Firebase failed, attempting local fallback...")
                self.use_local_fallback = True
                return self.create_report(report_type, description, city, lat, lon)
            return False, {"error": str(e)}
    
    def get_all_reports(self, filter_status: str = None) -> List[Dict]:
        """
        Fetch all reports from database
        
        Args:
            filter_status: Optional filter - 'resolved', 'unresolved', or None for all
        
        Returns:
            List of reports sorted by newest first
        """
        try:
            if self.use_local_fallback:
                reports_data = self._read_local_reports()
            else:
                reports_ref = rtdb.reference('communityReports')
                reports_data = reports_ref.get()
            
            if not reports_data:
                return []
            
            reports_list = []
            
            for report_id, report_data in reports_data.items():
                if not report_data:
                    continue
                
                # Apply status filter if provided
                if filter_status:
                    status = report_data.get('status', 'unresolved')
                    if status != filter_status:
                        continue
                
                # Add report ID to data
                report_with_id = {
                    'id': report_id,
                    **report_data
                }
                reports_list.append(report_with_id)
            
            # Sort by timestamp (newest first)
            reports_list.sort(
                key=lambda r: r.get('timestamp', ''),
                reverse=True
            )
            
            return reports_list
        except Exception as e:
            print(f"Error fetching reports: {e}")
            return []
    
    def mark_resolved(self, report_id: str) -> Tuple[bool, Dict]:
        """Mark a report as resolved"""
        try:
            update_data = {
                'status': 'resolved',
                'resolvedAt': datetime.now().isoformat()
            }
            
            if self.use_local_fallback:
                reports = self._read_local_reports()
                if report_id in reports:
                    reports[report_id].update(update_data)
                    if self._write_local_reports(reports):
                        return True, {"message": "Report marked as resolved"}
                    else:
                        return False, {"error": "Failed to update report"}
                else:
                    return False, {"error": "Report not found"}
            else:
                report_ref = rtdb.reference(f'communityReports/{report_id}')
                report_ref.update(update_data)
                return True, {"message": "Report marked as resolved"}
        except Exception as e:
            print(f"Error marking report resolved: {e}")
            return False, {"error": str(e)}
    
    def mark_unresolved(self, report_id: str) -> Tuple[bool, Dict]:
        """Mark a report as unresolved"""
        try:
            update_data = {
                'status': 'unresolved',
                'resolvedAt': None
            }
            
            if self.use_local_fallback:
                reports = self._read_local_reports()
                if report_id in reports:
                    reports[report_id].update(update_data)
                    if self._write_local_reports(reports):
                        return True, {"message": "Report marked as unresolved"}
                    else:
                        return False, {"error": "Failed to update report"}
                else:
                    return False, {"error": "Report not found"}
            else:
                report_ref = rtdb.reference(f'communityReports/{report_id}')
                report_ref.update(update_data)
                return True, {"message": "Report marked as unresolved"}
        except Exception as e:
            print(f"Error marking report unresolved: {e}")
            return False, {"error": str(e)}
    
    def add_admin_comment(self, report_id: str, admin_email: str, comment: str) -> Tuple[bool, Dict]:
        """Add an admin comment to a report"""
        try:
            new_comment = {
                'adminEmail': admin_email,
                'comment': comment,
                'timestamp': datetime.now().isoformat()
            }
            
            if self.use_local_fallback:
                reports = self._read_local_reports()
                if report_id in reports:
                    comments = reports[report_id].get('adminComments', [])
                    if not isinstance(comments, list):
                        comments = []
                    comments.append(new_comment)
                    reports[report_id]['adminComments'] = comments
                    if self._write_local_reports(reports):
                        return True, {"message": "Comment added successfully"}
                    else:
                        return False, {"error": "Failed to add comment"}
                else:
                    return False, {"error": "Report not found"}
            else:
                report_ref = rtdb.reference(f'communityReports/{report_id}')
                current_data = report_ref.get()
                comments = current_data.get('adminComments', []) if current_data else []
                comments.append(new_comment)
                report_ref.update({'adminComments': comments})
                return True, {"message": "Comment added successfully"}
        except Exception as e:
            print(f"Error adding comment: {e}")
            return False, {"error": str(e)}
    
    def delete_report(self, report_id: str) -> Tuple[bool, Dict]:
        """Delete a report"""
        try:
            if self.use_local_fallback:
                reports = self._read_local_reports()
                if report_id in reports:
                    del reports[report_id]
                    if self._write_local_reports(reports):
                        return True, {"message": "Report deleted"}
                    else:
                        return False, {"error": "Failed to delete report"}
                else:
                    return False, {"error": "Report not found"}
            else:
                report_ref = rtdb.reference(f'communityReports/{report_id}')
                report_ref.delete()
                return True, {"message": "Report deleted"}
        except Exception as e:
            print(f"Error deleting report: {e}")
            return False, {"error": str(e)}
    
    def get_report_stats(self) -> Dict:
        """Get statistics about all reports"""
        try:
            reports = self.get_all_reports()
            
            resolved_count = sum(1 for r in reports if r.get('status') == 'resolved')
            unresolved_count = len(reports) - resolved_count
            
            return {
                "total": len(reports),
                "resolved": resolved_count,
                "unresolved": unresolved_count
            }
        except Exception as e:
            print(f"Error getting report stats: {e}")
            return {"total": 0, "resolved": 0, "unresolved": 0}
