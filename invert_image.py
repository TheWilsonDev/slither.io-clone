from PIL import Image, ImageChops
import sys

try:
    img_path = sys.argv[1]
    img = Image.open(img_path)

    # Handle RGBA images by converting to RGB first, then merging alpha back
    if img.mode == 'RGBA':
        r,g,b,a = img.split()
        rgb_image = Image.merge('RGB', (r,g,b))
        inverted_rgb_image = ImageChops.invert(rgb_image)
        r2, g2, b2 = inverted_rgb_image.split()
        final_img = Image.merge('RGBA', (r2, g2, b2, a))
    elif img.mode == 'P': # Paletted images
        # Convert to RGBA to handle palette and potential transparency
        img = img.convert("RGBA")
        r,g,b,a = img.split()
        rgb_image = Image.merge('RGB', (r,g,b))
        inverted_rgb_image = ImageChops.invert(rgb_image)
        r2, g2, b2 = inverted_rgb_image.split()
        final_img = Image.merge('RGBA', (r2, g2, b2, a))
    else: # For RGB and other modes that don't have alpha or palette
        final_img = ImageChops.invert(img)

    final_img.save(img_path)
    print(f"Successfully inverted colors of {img_path} and replaced the original file.")

except FileNotFoundError:
    print(f"Error: Image file not found at {img_path}")
except IndexError:
    print("Error: Please provide the image path as a command-line argument.")
    print("Usage: python invert_image.py <path_to_image>")
except Exception as e:
    print(f"An error occurred: {e}") 