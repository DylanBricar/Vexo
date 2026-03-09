export interface Message {
  id: number;
  sender_id: number;
  content: string | null;
  media: string | null;
  has_media?: boolean;
  media_type: string | null;
  is_read: boolean;
  created_at: string;
  reply_to: number | null;
  edited: boolean;
}
