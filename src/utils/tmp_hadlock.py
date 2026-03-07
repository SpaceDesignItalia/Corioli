import json

def linear_interp(wk, w1, w2, v1, v2):
    return v1 + (wk - w1) * (v2 - v1) / (w2 - w1)

def get_sd(wk, sd14, sd40):
    return linear_interp(wk, 14, 40, sd14, sd40)

def generate_table(name, means, sd14, sd40):
    print(f"const {name}: CentilePoint[] = [")
    for i, week in enumerate(range(14, 42, 2)):
        if i < len(means):
            mean = means[i]
            sd = get_sd(week, sd14, sd40)
            p5 = round(mean - 1.645 * sd)
            p95 = round(mean + 1.645 * sd)
            print(f"  {{week:{week}, p5:{p5}, p50:{mean}, p95:{p95}}},")
    print("];")

bpd_m = [27, 34, 41, 47, 54, 60, 65, 70, 75, 80, 84, 88, 91, 94]
hc_m  = [99, 124, 150, 175, 198, 222, 243, 263, 282, 298, 313, 325, 335, 343]
ac_m  = [78, 103, 127, 152, 175, 197, 219, 240, 259, 279, 298, 316, 333, 348]
fl_m  = [14, 20, 27, 33, 38, 44, 49, 54, 58, 62, 65, 69, 72, 74]

print("// --- Hadlock Biometric Centiles (Smoothed Means & Empirical SDs) ---")
generate_table("BPD_CENTILES", bpd_m, 2.5, 4.5)
generate_table("HC_CENTILES", hc_m, 6.0, 14.0)
generate_table("AC_CENTILES", ac_m, 6.0, 20.0)
generate_table("FL_CENTILES", fl_m, 1.5, 3.5)
