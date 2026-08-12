"""
岐黄阁 · 性能基准测试
运行方式: python tests/benchmark.py
"""
import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def measure_latency(fn, warmup=100, iterations=1000):
    """测量函数延迟"""
    for _ in range(warmup):
        fn()

    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        fn()
        elapsed = (time.perf_counter() - start) * 1000  # ms
        times.append(elapsed)

    times.sort()
    avg = sum(times) / len(times)
    p50 = times[int(len(times) * 0.50)]
    p95 = times[int(len(times) * 0.95)]
    p99 = times[int(len(times) * 0.99)]
    qps = round(1000 / avg, 1)
    return {
        "avg_ms": round(avg, 4),
        "p50_ms": round(p50, 4),
        "p95_ms": round(p95, 4),
        "p99_ms": round(p99, 4),
        "qps": qps
    }


def main():
    print("=" * 60)
    print("岐黄阁 · 性能基准测试")
    print("=" * 60)

    # 1. 本草查询基准
    print("\n[1] 本草查询引擎")
    try:
        from static.js.engines.bencao_engine import BenCaoEngine
        engine = BenCaoEngine()

        def bench_search():
            engine.search("麻黄")

        r = measure_latency(bench_search, warmup=50, iterations=500)
        print(f"  搜索(麻黄): 平均 {r['avg_ms']}ms, P95 {r['p95_ms']}ms, P99 {r['p99_ms']}ms, QPS {r['qps']}")
    except Exception as e:
        print(f"  本草查询基准失败: {e}")

    # 2. 配伍检查基准
    print("\n[2] 配伍规则引擎")
    try:
        from static.js.engines.interaction_engine import InteractionEngine
        engine = InteractionEngine()

        def bench_check():
            engine.check(["甘草", "大戟", "海藻", "人参"])

        r = measure_latency(bench_check, warmup=50, iterations=500)
        print(f"  配伍检查(4味药): 平均 {r['avg_ms']}ms, P95 {r['p95_ms']}ms, P99 {r['p99_ms']}ms, QPS {r['qps']}")
    except Exception as e:
        print(f"  配伍检查基准失败: {e}")

    # 3. 方剂查询基准
    print("\n[3] 方剂解析引擎")
    try:
        from static.js.engines.fangji_engine import FangjiEngine
        engine = FangjiEngine()

        def bench_formula():
            engine.query("麻黄汤")

        r = measure_latency(bench_formula, warmup=50, iterations=500)
        print(f"  方剂查询(麻黄汤): 平均 {r['avg_ms']}ms, P95 {r['p95_ms']}ms, P99 {r['p99_ms']}ms, QPS {r['qps']}")
    except Exception as e:
        print(f"  方剂查询基准失败: {e}")

    print("\n" + "=" * 60)
    print("基准测试完成")
    print("=" * 60)


if __name__ == "__main__":
    main()