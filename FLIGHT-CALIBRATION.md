# Flight-time field measurements

This file records **observed fictional IRON NEST game projectile travel times**, not predictions from real-world ballistics.

| Test ID | Bearing | Range | Player elevation | Charges | Fire second | Impact second | Observed flight | Shell |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 001 | 85.6° | 8.94 km | 53.4° | 2 | 00 | 34 | **34 s** | Not provided |

**Do not alter field observations to match a formula.** The current community elevation formula gives **53.64°** for 8.94 km with two charges; the user explicitly reported **53.4°**. The difference is **0.24°**, equivalent to roughly 40 m under the simplified 2-charge range model.

This dataset contains one flight-time sample. No reliable flight-time model can be fitted to a single sample. The Train Tracker requires manually observed projectile travel time; using this 34-second figure at a different charge, range or shell is an unverified extrapolation.

For a future model, gather measurements at several **ranges using the same charge and shell**, then compare **different charges at similar ranges**, with measured firing and impact seconds and in-game launch elevation. A consistent time reference and multiple trials per setting will help quantify measurement noise.

If an impact is desired at `10:10:10` and the shot's flight time is known to be 34 seconds, fire at `10:09:36`. This is arithmetic, not proof that another shot has a 34-second duration.
