from pathlib import Path
from PIL import Image
src = Path('assets\desktop_icon.png')                                                                                                                                                                         
img = Image.open(src).convert('RGBA')                                                                                                                                                                      
out = Path('assets\desktop_icon_rgba.png')                                                                                                                                                                    
img.save(out)                                                                                                                                                                                              
print('saved', out)   