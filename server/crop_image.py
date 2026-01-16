"""
Image Cropping Service
Crops images based on coordinates and dimensions
"""

import sys
import json
import os
from PIL import Image

def crop_image(image_path, output_path, x, y, width, height):
    """
    Crop an image based on coordinates and dimensions
    
    Args:
        image_path: Path to the input image
        output_path: Path to save the cropped image
        x: X coordinate (left)
        y: Y coordinate (top)
        width: Width of the crop area
        height: Height of the crop area
    
    Returns:
        dict: Result with success status and output path
    """
    try:
        # Open the image
        if not os.path.exists(image_path):
            return {
                "success": False,
                "error": f"Image file not found: {image_path}"
            }
        
        image = Image.open(image_path)
        
        # Get image dimensions
        img_width, img_height = image.size
        
        # Validate coordinates
        if x < 0 or y < 0:
            return {
                "success": False,
                "error": f"Invalid coordinates: x={x}, y={y} (must be >= 0)"
            }
        
        # Calculate right and bottom coordinates
        right = x + width
        bottom = y + height
        
        # Clamp to image boundaries
        if right > img_width:
            right = img_width
            width = right - x
        
        if bottom > img_height:
            bottom = img_height
            height = bottom - y
        
        # Validate final dimensions
        if width <= 0 or height <= 0:
            return {
                "success": False,
                "error": f"Invalid crop dimensions: width={width}, height={height}"
            }
        
        # Crop the image (left, top, right, bottom)
        cropped_image = image.crop((x, y, right, bottom))
        
        # Ensure output directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        # Save the cropped image
        cropped_image.save(output_path)
        
        return {
            "success": True,
            "output_path": output_path,
            "original_size": {"width": img_width, "height": img_height},
            "crop_area": {"x": x, "y": y, "width": width, "height": height},
            "cropped_size": {"width": width, "height": height}
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def main():
    """Main function to handle command line arguments"""
    if len(sys.argv) < 6:
        # If called without arguments, expect JSON input via stdin
        try:
            input_data = json.loads(sys.stdin.read())
            image_path = input_data.get("image_path")
            output_path = input_data.get("output_path")
            x = int(input_data.get("x", 0))
            y = int(input_data.get("y", 0))
            width = int(input_data.get("width", 0))
            height = int(input_data.get("height", 0))
        except Exception as e:
            print(json.dumps({
                "success": False,
                "error": f"Invalid input: {str(e)}"
            }))
            sys.exit(1)
    else:
        # Command line arguments
        image_path = sys.argv[1]
        output_path = sys.argv[2]
        x = int(sys.argv[3])
        y = int(sys.argv[4])
        width = int(sys.argv[5])
        height = int(sys.argv[6]) if len(sys.argv) > 6 else width
    
    # Crop the image
    result = crop_image(image_path, output_path, x, y, width, height)
    
    # Output result as JSON
    print(json.dumps(result))
    
    # Exit with appropriate code
    sys.exit(0 if result["success"] else 1)

if __name__ == "__main__":
    main()
