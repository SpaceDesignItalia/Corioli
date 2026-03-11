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

# Reference for Hadlock BPD outer-to-inner (approx):
# 14w: 26, 16w: 33, 18w:41, 20w: 48, 22w: 55, 24w: 61, 26w: 67, 28w: 73, 
# 30w: 78, 32w: 83, 34w: 87, 36w: 90, 38w: 93, 40w: 95
bpd_m = [26, 33, 41, 48, 55, 61, 67, 73, 78, 83, 87, 90, 93, 95]

generate_table("BPD_CENTILES", bpd_m, 2.5, 4.5)
