"""Visible rear boarding steps shared by the renderer and collision export.
The source rear ramp reaches the lower hold. Fit treads in its open stairwell,
retaining the aircraft, handrails and evacuation slide in their source positions.
"""
import numpy as np

def rear_steps():
    count = 22
    start, end = -63.2, -56.6
    depth = (end - start) / count
    return [dict(x=-39.45, z=start+(i+.5)*depth, w=1.34, d=depth,
                 base=.98, h=round(1.02+(5.14-1.02)*(i+1)/count-.98, 5))
            for i in range(count)]

def step_triangles(steps):
    triangles = []
    for s in steps:
        x, z, y = s['x'], s['z'], s['base']
        w, d, h = s['w']/2, s['d']/2, s['h']
        p = np.array([[x-w,y,z-d],[x+w,y,z-d],[x+w,y,z+d],[x-w,y,z+d],
                      [x-w,y+h,z-d],[x+w,y+h,z-d],[x+w,y+h,z+d],[x-w,y+h,z+d]])
        for a,b,c,e in [(4,5,6,7),(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
            triangles.extend([p[[a,b,c]],p[[a,c,e]]])
    return np.array(triangles)
