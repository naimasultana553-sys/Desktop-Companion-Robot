// ============================================================
// Desktop Companion Robot — Parametric Enclosure
// Designed for FDM 3D printing (PLA/PETG)
// Export each shell separately as STL for multi-color printing
// ============================================================
// Components: XIAO ESP32-S3, SSD1306 OLED 0.96", PCA9685,
//             2x SG90 servo, 5V PSU, breadboard fragments
// ============================================================

/* [Overall Dimensions] */
total_height    = 110;   // mm, total robot height
head_ratio      = 0.42;  // head as fraction of total height
wall            = 2.0;   // shell wall thickness
clearance       = 0.3;   // per-side clearance for fit
fn_smooth       = 80;    // surface smoothness (increase for quality, decrease for speed)

/* [Head] */
head_h          = total_height * head_ratio;          // ~46mm
head_r          = head_h * 0.55;                      // dome radius
head_w          = head_r * 2.1;                       // slightly wider than tall
oled_w          = 24;                                 // OLED screen width (cutout)
oled_h          = 14;                                 // OLED screen height (cutout)
oled_offset_z   = 2;                                  // screen recess depth
screen_bevel    = 1.5;                                // bevel around screen cutout

/* [Body] */
body_h          = total_height - head_h;              // ~64mm
body_r_top      = head_w * 0.48;                      // neck opening radius
body_r_mid      = head_w * 0.62;                      // widest point (egg bulge)
body_r_bot      = head_w * 0.55;                      // base taper

/* [Collar Accent] */
collar_h        = 8;                                  // height of accent band
collar_gap      = 1.0;                                // gap between collar and body

/* [Base Stand] */
base_r          = body_r_bot + 4;                     // wider than body for stability
base_h          = 6;                                  // stand thickness
base_fillet     = 3;                                  // edge roundover

/* [Neck Joint] */
neck_r          = body_r_top - 1;                     // neck cylinder radius
neck_h          = 10;                                 // neck cylinder height (hidden)
servo_clear_r   = 12;                                 // pan servo clearance radius

/* [Internal Mounting] */
pcb_clearance   = 1.5;                                // gap around PCBs
mount_post_r    = 2;                                  // screw post radius
mount_hole_r    = 1.0;                                // M2 screw hole radius

// ============================================================
// MODULES
// ============================================================

// Smooth egg shape via revolution
module egg_body(r_top, r_mid, r_bot, h, wall_thick) {
    intersection() {
        scale([1, 1, h / (r_mid * 2)])
            sphere(r = r_mid * 2, $fn = fn_smooth);
        translate([0, 0, -1])
            cylinder(h = h + 2, r = r_mid * 1.5, $fn = fn_smooth);
    }
}

module egg_shell(r_top, r_mid, r_bot, h, t) {
    difference() {
        egg_body(r_top, r_mid, r_bot, h, t);
        translate([0, 0, t])
            egg_body(r_top, r_mid, r_bot, h - t * 2, t);
    }
}

// Dome head with OLED screen cutout
module head_shell() {
    difference() {
        // Outer dome
        scale([head_w / 2, 1, head_h / head_r])
            sphere(r = head_r, $fn = fn_smooth);

        // Hollow interior
        scale([(head_w - wall * 2) / 2, 1, (head_h - wall) / head_r])
            sphere(r = head_r, $fn = fn_smooth);

        // Bottom opening (for neck joint)
        translate([0, 0, -1])
            cylinder(h = wall + 2, r = neck_r + clearance, $fn = fn_smooth);

        // OLED screen cutout — front face
        translate([0, -head_w / 2 + wall - 0.5, head_h * 0.45]) {
            // Main screen opening
            translate([0, 0, 0])
                cube([oled_w + clearance * 2, wall + 2, oled_h + clearance * 2], center = true);
            // Bevel/chamfer
            translate([0, -0.3, 0])
                cube([oled_w + screen_bevel * 2 + clearance * 2, wall + 2, oled_h + screen_bevel * 2 + clearance * 2], center = true);
        }

        // Side ventilation slots (optional, 2 per side)
        for (i = [-1, 1]) {
            for (j = [0, 1]) {
                translate([i * head_w * 0.38, 0, head_h * 0.25 + j * 6])
                    rotate([0, 90, 0])
                        cylinder(h = wall + 2, r = 1.2, center = true, $fn = 20);
            }
        }
    }

    // OLED screen mounting ledge (inside)
    translate([0, -head_w / 2 + wall + oled_offset_z, head_h * 0.45])
        difference() {
            cube([oled_w + 4, 1.5, oled_h + 4], center = true);
            cube([oled_w + clearance, 2, oled_h + clearance], center = true);
        }
}

// Body shell — egg shape
module body_shell() {
    difference() {
        // Outer egg
        scale([1, 1, body_h / (body_r_mid * 2)])
            intersection() {
                sphere(r = body_r_mid * 2, $fn = fn_smooth);
                cylinder(h = body_h + 2, r = body_r_mid * 1.5, $fn = fn_smooth);
            }

        // Hollow interior
        translate([0, 0, wall])
            scale([1, 1, (body_h - wall * 2) / ((body_r_mid - wall) * 2)])
                intersection() {
                    sphere(r = (body_r_mid - wall) * 2, $fn = fn_smooth);
                    cylinder(h = body_h, r = (body_r_mid - wall) * 1.5, $fn = fn_smooth);
                }

        // Neck opening (top)
        translate([0, 0, body_h - 1])
            cylinder(h = wall + 2, r = neck_r + clearance, $fn = fn_smooth);

        // Base opening (bottom)
        translate([0, 0, -1])
            cylinder(h = wall + 2, r = body_r_bot - wall + clearance, $fn = fn_smooth);

        // Wire pass-through slots (4 around base)
        for (i = [0:3]) {
            rotate([0, 0, i * 90 + 45])
                translate([body_r_bot * 0.6, 0, 5])
                    cube([8, 3, 6], center = true);
        }
    }

    // Internal mounting posts (for PCB standoffs)
    for (i = [0:2]) {
        rotate([0, 0, i * 120])
            translate([body_r_mid * 0.45, 0, 8]) {
                difference() {
                    cylinder(h = body_h * 0.5, r = mount_post_r, $fn = 24);
                    translate([0, 0, -1])
                        cylinder(h = body_h * 0.5 + 2, r = mount_hole_r, $fn = 20);
                }
            }
    }
}

// Collar accent ring — fits between head and body
module collar_accent() {
    collar_r = body_r_top + collar_gap;
    difference() {
        // Outer ring
        translate([0, 0, -collar_h / 2])
            rotate_extrude($fn = fn_smooth)
                translate([collar_r, 0, 0])
                    circle(r = collar_h / 2, $fn = 40);
        // Inner cutout (neck clearance)
        translate([0, 0, -collar_h])
            cylinder(h = collar_h * 2, r = neck_r + clearance + 0.5, $fn = fn_smooth);
    }
}

// Base stand — flat rounded disc
module base_stand() {
    difference() {
        // Rounded disc
        minkowski() {
            cylinder(h = base_h - base_fillet * 2, r = base_r - base_fillet, $fn = fn_smooth);
            sphere(r = base_fillet, $fn = 30);
        }
        // Top opening (body sits into)
        translate([0, 0, base_h - wall])
            cylinder(h = wall + 1, r = body_r_bot + clearance, $fn = fn_smooth);
        // Bottom cutout (weight reduction)
        translate([0, 0, -1])
            cylinder(h = wall + 1, r = base_r * 0.7, $fn = fn_smooth);
        // Wire channel
        translate([0, 0, -1])
            cube([12, 12, wall + 2], center = true);
    }
    // Centering pegs (3)
    for (i = [0:2]) {
        rotate([0, 0, i * 120 + 60])
            translate([body_r_bot * 0.5, 0, base_h - wall - 1.5])
                cylinder(h = 1.5, r = 1.5, $fn = 20);
    }
}

// Pan servo mount (internal, not printed separately)
module servo_mount_pan() {
    difference() {
        cylinder(h = 4, r = servo_clear_r, $fn = fn_smooth);
        translate([0, 0, -1])
            cylinder(h = 6, r = servo_clear_r - wall, $fn = fn_smooth);
        // Servo body slot
        translate([-5, -14, -1])
            cube([10, 28, 6]);
    }
}

// ============================================================
// ASSEMBLY VIEWS (for preview)
// ============================================================

// Uncomment one at a time for STL export:

// --- HEAD SHELL ---
// head_shell();

// --- BODY SHELL ---
// body_shell();

// --- COLLAR ACCENT ---
// collar_accent();

// --- BASE STAND ---
// base_stand();

// --- FULL ASSEMBLY (preview only, not printable as-is) ---
color("White") body_shell();
translate([0, 0, body_h + 0.5])
    color("White") head_shell();
translate([0, 0, body_h + head_h + 2])
    color("Teal") collar_accent();
translate([0, 0, -base_h / 2])
    color("White") base_stand();

// ============================================================
// PRINT SETTINGS (suggested)
// ============================================================
// Layer height:  0.2mm (standard) or 0.12mm (fine)
// Infill:        15-20%
// Supports:      Yes, for head dome overhang
// Orientation:   Head dome-up, body upright, base flat
// Material:      PLA or PETG recommended
// Post-process:  Light sanding + spray primer for smooth finish
// Assembly:      Head press-fits onto neck post, collar slides on,
//                body sits into base stand recess
