from linebot import LineBotApi
from linebot.exceptions import LineBotApiError
from app.core.deps import get_line_bot_api

line_bot_api = get_line_bot_api()


async def fetch_user_profile(user_id: str):
    try:
        profile = line_bot_api.get_profile(user_id)
        # profile.display_name, profile.user_id, profile.picture_url, profile.status_message
        return profile
    except LineBotApiError as e:
        # 處理錯誤
        print(f"Error: {e.status_code} {e.error.message}")
        return None