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
            print(f"  {{ week: {week}, p5: {p5}, p50: {mean}, p95: {p95} }},")
    print("];")

fl_m  = [14, 20, 27, 33, 38, 44, 49, 54, 58, 61, 65, 68, 71, 74]

generate_table("FL_CENTILES", fl_m, 1.5, 3.5)
