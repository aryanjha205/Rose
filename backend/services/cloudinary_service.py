import os
import uuid
from flask import current_app
import cloudinary
import cloudinary.uploader

def configure_cloudinary():
    cloud_name = current_app.config.get("CLOUDINARY_CLOUD_NAME")
    api_key = current_app.config.get("CLOUDINARY_API_KEY")
    api_secret = current_app.config.get("CLOUDINARY_API_SECRET")
    cloudinary_url = current_app.config.get("CLOUDINARY_URL")

    if cloudinary_url:
        cloudinary.config(cloudinary_url=cloudinary_url, secure=True)
        return True
    elif cloud_name and api_key and api_secret:
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True
        )
        return True
    return False

def upload_avatar(file_storage, user_id: int) -> str:
    """
    Uploads avatar directly to Cloudinary.
    No local file storage fallback.
    """
    has_cloudinary = configure_cloudinary()
    if not has_cloudinary:
        raise ValueError("Cloudinary credentials are not configured. Cloudinary is required for profile avatar storage.")

    upload_result = cloudinary.uploader.upload(
        file_storage,
        folder="webcall/avatars",
        public_id=f"user_{user_id}_{uuid.uuid4().hex[:8]}",
        overwrite=True,
        resource_type="image",
        transformation=[
            {"width": 300, "height": 300, "crop": "fill", "gravity": "face"},
            {"quality": "auto", "fetch_format": "auto"}
        ]
    )
    secure_url = upload_result.get("secure_url")
    if not secure_url:
        raise ValueError("Cloudinary failed to return a secure image URL.")
    return secure_url
