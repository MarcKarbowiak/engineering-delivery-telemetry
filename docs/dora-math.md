# DORA Math

## Symbols

- `E`: event set
- `W = [t_start, t_end]`: analysis window
- `|W_days|`: window length in days
- `DeploySuccess`: events with `type = deployment_succeeded`
- `DeployFail`: events with `type = deployment_failed`
- `IncidentOpen`: events with `type = incident_opened`
- `IncidentResolve`: events with `type = incident_resolved`

## Deployment Frequency

\[
DF(W) = \frac{|\{e \in E : e.type = deployment\_succeeded \land e.timestamp \in W\}|}{|W_{days}|}
\]

Interpretation: successful deployments per day in the selected window.

Example:
- 14 successful deployments in a 7-day window
- `DF = 14 / 7 = 2.0 deployments/day`

## Lead Time For Changes

For each deployment `d`, find earliest associated commit `c` using `commitId` or `correlationId`:

\[
LT_d = t(d) - t(c_{earliest})
\]

Mean lead time:

\[
LT = \frac{1}{n} \sum_{i=1}^{n} LT_{d_i}
\]

Implementation returns milliseconds; API converts to hours.

## Change Failure Rate

\[
CFR = \frac{|DeployFail|}{|DeployFail| + |DeploySuccess|}
\]

Example:
- 4 failed deployments, 36 successful deployments
- `CFR = 4 / 40 = 0.10 = 10%`

## Mean Time To Recovery (MTTR)

Incident durations are paired by `correlationId` when present, otherwise by service-order fallback.

For each paired incident:

\[
RT_i = t(resolve_i) - t(open_i)
\]

\[
MTTR = \frac{1}{m} \sum_{i=1}^{m} RT_i
\]

Implementation returns milliseconds; API converts to hours.

## Edge Cases

- Empty denominators (`0 deployments`, `0 incidents`) return `0`.
- Invalid or reversed window (`end <= start`) returns deployment frequency `0`.
- Lead time ignores deployments without associated commits.
- Incident resolve events without a matching open event are ignored.