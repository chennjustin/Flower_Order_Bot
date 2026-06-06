from linebot import LineBotApi
from linebot.exceptions import LineBotApiError


async def fetch_user_profile(line_bot_api: LineBotApi, user_id: str):
    try:
        profile = line_bot_api.get_profile(user_id)
        return profile
    except LineBotApiError as e:
        print(f"Error: {e.status_code} {e.error.message}")
        return None
