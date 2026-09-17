"""
Community Message Broadcast Service
Manages community-wide announcements with expiry dates
Supports both Firebase Realtime DB and local file storage fallback
"""

from typing import List, Dict, Tuple
from datetime import datetime
import firebase_admin
from firebase_admin import db as rtdb
import os
import json
from pathlib import Path

class CommunityMessageService:
    """Service for managing community broadcast messages"""
    
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
            # Try to check if Firebase is initialized and accessible
            test_ref = rtdb.reference('.info/connected')
            test_ref.get()
            return False
        except:
            # If Firebase fails, use local fallback
            return True
    
    def _get_local_messages_file(self) -> str:
        """Get path to local messages storage file"""
        return os.path.join(self.local_storage_path, 'community_messages.json')
    
    def _read_local_messages(self) -> Dict:
        """Read messages from local file storage"""
        try:
            file_path = self._get_local_messages_file()
            if os.path.exists(file_path):
                with open(file_path, 'r') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            print(f"Error reading local messages: {e}")
            return {}
    
    def _write_local_messages(self, messages: Dict) -> bool:
        """Write messages to local file storage"""
        try:
            file_path = self._get_local_messages_file()
            with open(file_path, 'w') as f:
                json.dump(messages, f, indent=2)
            return True
        except Exception as e:
            print(f"Error writing local messages: {e}")
            return False
    
    def _generate_message_id(self) -> str:
        """Generate a unique message ID"""
        import uuid
        return str(uuid.uuid4())
    
    def create_message(self, title: str, content: str, expires_at: str) -> Tuple[bool, Dict]:
        """
        Create and publish a community message
        
        Args:
            title: Message title
            content: Message content/body
            expires_at: ISO format datetime string for message expiry
        
        Returns:
            Tuple of (success: bool, result: dict with messageId)
        """
        try:
            new_message = {
                'title': title,
                'content': content,
                'createdAt': datetime.now().isoformat(),
                'expiresAt': expires_at,
                'active': True
            }
            
            if self.use_local_fallback:
                # Use local file storage
                messages = self._read_local_messages()
                message_id = self._generate_message_id()
                messages[message_id] = new_message
                
                if self._write_local_messages(messages):
                    print(f"✓ Message saved to local storage: {message_id}")
                    return True, {
                        "messageId": message_id,
                        "message": "Message published successfully (stored locally)",
                        "storageType": "local"
                    }
                else:
                    return False, {"error": "Failed to save message locally"}
            else:
                # Use Firebase Realtime DB
                messages_ref = rtdb.reference('communityMessages')
                result = messages_ref.push(new_message)
                message_id = result.key
                
                print(f"✓ Message saved to Firebase: {message_id}")
                return True, {
                    "messageId": message_id,
                    "message": "Message published successfully",
                    "storageType": "firebase"
                }
        except Exception as e:
            print(f"Error creating community message: {e}")
            
            # Try fallback if Firebase fails
            if not self.use_local_fallback:
                print("Firebase failed, attempting local fallback...")
                self.use_local_fallback = True
                return self.create_message(title, content, expires_at)
            
            return False, {"error": str(e)}
    
    def get_active_messages(self) -> List[Dict]:
        """
        Fetch all non-expired community messages
        
        Returns:
            List of active messages
        """
        try:
            if self.use_local_fallback:
                # Use local file storage
                messages_data = self._read_local_messages()
            else:
                # Use Firebase
                messages_ref = rtdb.reference('communityMessages')
                messages_data = messages_ref.get()
            
            if not messages_data:
                return []
            
            active_messages = []
            now = datetime.now()
            
            for message_id, message_data in messages_data.items():
                if not message_data:
                    continue
                
                # Check if message has expired
                expires_at_str = message_data.get('expiresAt', '')
                if expires_at_str:
                    try:
                        expires_at = datetime.fromisoformat(expires_at_str)
                        if now > expires_at:
                            continue  # Skip expired messages
                    except:
                        pass
                
                # Add message ID to data
                message_with_id = {
                    'id': message_id,
                    **message_data
                }
                active_messages.append(message_with_id)
            
            # Sort by creation date (newest first)
            active_messages.sort(
                key=lambda m: m.get('createdAt', ''),
                reverse=True
            )
            
            return active_messages
        except Exception as e:
            print(f"Error fetching community messages: {e}")
            return []
    
    def delete_message(self, message_id: str) -> Tuple[bool, Dict]:
        """Delete a community message"""
        try:
            if self.use_local_fallback:
                messages = self._read_local_messages()
                if message_id in messages:
                    del messages[message_id]
                    if self._write_local_messages(messages):
                        print(f"✓ Message deleted from local storage: {message_id}")
                        return True, {"message": "Message deleted"}
                    else:
                        return False, {"error": "Failed to delete message"}
                else:
                    return False, {"error": "Message not found"}
            else:
                message_ref = rtdb.reference(f'communityMessages/{message_id}')
                message_ref.delete()
                print(f"✓ Message deleted from Firebase: {message_id}")
                return True, {"message": "Message deleted"}
        except Exception as e:
            print(f"Error deleting message: {e}")
            return False, {"error": str(e)}
    
    def update_message(self, message_id: str, title: str, content: str, expires_at: str) -> Tuple[bool, Dict]:
        """Update a community message"""
        try:
            update_data = {
                'title': title,
                'content': content,
                'expiresAt': expires_at,
                'updatedAt': datetime.now().isoformat()
            }
            
            if self.use_local_fallback:
                messages = self._read_local_messages()
                if message_id in messages:
                    messages[message_id].update(update_data)
                    if self._write_local_messages(messages):
                        print(f"✓ Message updated in local storage: {message_id}")
                        return True, {"message": "Message updated"}
                    else:
                        return False, {"error": "Failed to update message"}
                else:
                    return False, {"error": "Message not found"}
            else:
                message_ref = rtdb.reference(f'communityMessages/{message_id}')
                message_ref.update(update_data)
                print(f"✓ Message updated in Firebase: {message_id}")
                return True, {"message": "Message updated"}
        except Exception as e:
            print(f"Error updating message: {e}")
            return False, {"error": str(e)}
