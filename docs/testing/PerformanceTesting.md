# Performance Testing

## What it is

One focused JMeter test plan (`qa/perf/login-dashboard-load-test.jmx`) covering login + dashboard load - scoped down from the full 9-type JMeter matrix (load/stress/spike/soak/etc.) to keep this real and actually run, rather than broad and untested.

## How it works

Thread group simulates concurrent users each doing: `POST /api/auth-service/login` → extract `access_token` (JSON path `$.data.access_token`) → `GET /api/projects-service/dashboard/summary` with that token. Both requests assert `responseCode == 200`; the dashboard request also asserts response time `< 2000ms`. Parameterized via JMeter properties (`-Jusers`, `-JrampUp`, `-Jloops`, `-Jhost`, `-Jport`) so it targets any environment without editing the file.

**Last real run** (20 users, 10s ramp-up, 5 loops = 200 requests, against the local stack):

| Sampler | Avg | p90 | Max | Errors |
|---|---|---|---|---|
| Login | 1963ms | 2986ms | 3496ms | 0 |
| Dashboard summary | 581ms | 979ms | 1589ms | 0 |

Login is markedly slower than the dashboard read - expected, since bcrypt password verification is deliberately CPU-expensive.

## Commands

```bash
cd qa/perf
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 jmeter -n -t login-dashboard-load-test.jmx \
  -l reports/results.jtl -e -o reports/html
open reports/html/index.html
```

Override load: `-Jusers=50 -JrampUp=20 -Jloops=10`.

## Not covered (by design, this round)

Stress, spike, soak, and dedicated concurrent-user-ramp tests from the original 9-type plan - flagged here rather than silently dropped.
