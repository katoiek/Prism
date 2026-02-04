from PIL import Image, ImageDraw
import sys

def apply_rounded_mask_only(input_path, output_path):
    # Load the original design (with white background intact)
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    
    # Create a rounded rectangle mask
    # This will make ONLY the corners transparent, keeping the white background inside
    mask = Image.new('L', (width, height), 0)
    draw = ImageDraw.Draw(mask)
    
    # Draw a rounded rectangle that covers the entire canvas
    # with rounded corners (macOS style)
    radius = width * 0.22  # Typical macOS icon corner radius
    draw.rounded_rectangle(
        [0, 0, width, height],
        radius=radius,
        fill=255
    )
    
    # Apply the mask to make corners transparent, but keep the white background inside
    img.putalpha(mask)
    img.save(output_path, "PNG")

if __name__ == "__main__":
    # Use the original centered/maximized version
    input_file = "/Users/kei.kato/.gemini/antigravity/brain/dede4732-702c-4a29-8e13-652ec9c0ae7e/mimic_original_design_v5_1769677352516.png"
    
    # First, recreate the centered and scaled version
    from PIL import ImageOps
    
    img = Image.open(input_file).convert("RGBA")
    width, height = img.size
    
    # Find prism and center it
    grayscale = img.convert("L")
    prism_mask = grayscale.point(lambda p: 255 if p < 245 else 0)
    prism_bbox = prism_mask.getbbox()
    
    if prism_bbox:
        prism_center_x = (prism_bbox[0] + prism_bbox[2]) / 2
        prism_center_y = (prism_bbox[1] + prism_bbox[3]) / 2
        
        img_center_x = width / 2
        img_center_y = height / 2
        
        offset_x = img_center_x - prism_center_x
        offset_y = img_center_y - prism_center_y
        
        centered_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        centered_img.paste(img, (int(offset_x), int(offset_y)), img)
        
        # Scale up to hide outer boundaries
        scale_factor = 1.35
        new_size = int(width * scale_factor)
        scaled_img = centered_img.resize((new_size, new_size), Image.Resampling.LANCZOS)
        
        # Crop center
        crop_margin = (new_size - 1024) // 2
        final_img = scaled_img.crop((crop_margin, crop_margin, crop_margin + 1024, crop_margin + 1024))
        
        # Now apply ONLY the corner mask, keeping white background
        mask = Image.new('L', (1024, 1024), 0)
        draw = ImageDraw.Draw(mask)
        radius = 1024 * 0.22
        draw.rounded_rectangle([0, 0, 1024, 1024], radius=radius, fill=255)
        
        final_img.putalpha(mask)
        final_img.save("/Users/kei.kato/Dev/Prism/public/icon.png", "PNG")

if __name__ == "__main__":
    pass
