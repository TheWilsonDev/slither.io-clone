from PIL import Image, ImageDraw

def create_circle_image(diameter, color, output_filename):
    """
    Creates an image with a single colored circle on a transparent background.

    Args:
        diameter (int): The diameter of the circle (and the image dimensions).
        color (tuple): The RGBA color for the circle (e.g., (255, 0, 0, 255) for red).
        output_filename (str): The name of the file to save the image to.
    """
    # Create a new image with a transparent background (RGBA)
    img = Image.new("RGBA", (diameter, diameter), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    # Draw the circle
    # The bounding box for the ellipse is (x0, y0, x1, y1)
    # To leave a 1-pixel margin, we draw in (1, 1) to (diameter-1, diameter-1)
    # This makes the circle's actual diameter (diameter - 2)
    draw.ellipse((1, 1, diameter - 1, diameter - 1), fill=color)

    # Save the image
    img.save(output_filename)
    print(f"Image '{output_filename}' created successfully.")

if __name__ == "__main__":
    # Define the properties for the new circle
    circle_diameter = 60  # Based on the assumed size of your circle.png
    # Fill color (R, G, B, A) - using #FD4F4F with full opacity
    # #FD is 253, #4F is 79
    circle_color = (253, 79, 79, 255)
    output_file = "circle_no_border.png"

    create_circle_image(circle_diameter, circle_color, output_file) 