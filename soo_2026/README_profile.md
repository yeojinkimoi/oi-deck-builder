# Why `profile.do` here is disabled

Stata auto-runs `profile.do` from the **working directory** at startup. This
copy set `global wf_github` — not `workforce_github`, the name every deck
do-file actually uses. Launching Stata from this folder therefore left
`${workforce_github}` empty, made `adopath ++ "${workforce_github}/ado"` a
silent no-op, and every `dollar_labs` / `generate_clean_axis` call failed with
"unrecognized command".

It also hardcoded backslash paths and `set scheme`, duplicating what now lives
in the tracked `workforce-training/ado/oi_setup.do`.

Renamed to `profile.do.disabled` on 2026-10-07. Use `oi_setup.do` instead:

```stata
do "${workforce_github}/ado/oi_setup.do"
```
