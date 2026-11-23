import os
import uuid
import io
import base64
from flask import current_app
import cloudinary
import cloudinary.uploader
from PIL import Image, ImageOps

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

def process_avatar_fallback(file_storage, user_id: int) -> str:
    """
    Processes avatar locally using Pillow:
    Auto-orients, crops center square, resizes to 256x256, and returns a compressed Base64 Data URL.
    This guarantees 100% persistent storage in PostgreSQL without requiring external Cloudinary keys.
    """
    file_storage.seek(0)
    img = Image.open(file_storage)

    # Auto-orient based on camera EXIF tags (mobile photos)
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    # Convert to RGB (handle transparent PNG / alpha / palette modes cleanly)
    if img.mode != "RGB":
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode != "RGBA":
                img = img.convert("RGBA")
            background.paste(img, mask=img.split()[3])
            img = background
        else:
            img = img.convert("RGB")

    # Center crop to 1:1 square
    w, h = img.size
    min_dim = min(w, h)
    left = (w - min_dim) // 2
    top = (h - min_dim) // 2
    img = img.crop((left, top, left + min_dim, top + min_dim))

    # Resize smoothly to 256x256
    resample_filter = getattr(Image, "Resampling", Image).LANCZOS
    img = img.resize((256, 256), resample_filter)

    # Save to BytesIO buffer as optimized JPEG
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=85, optimize=True)
    buffer.seek(0)

    # Return persistent Data URL
    b64_data = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64_data}"

def upload_avatar(file_storage, user_id: int) -> str:
    """
    Uploads avatar to Cloudinary if configured.
    Falls back to optimized Pillow Base64 Data URL if Cloudinary is not configured or fails.
    """
    try:
        has_cloudinary = configure_cloudinary()
        if has_cloudinary:
            file_storage.seek(0)
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
            if secure_url:
                return secure_url
    except Exception as e:
        print(f"[Avatar Upload] Cloudinary upload skipped or failed ({e}), using optimized fallback.")

    # Fallback to local Pillow image optimization
    return process_avatar_fallback(file_storage, user_id)
