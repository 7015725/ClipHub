/* Deprecated: use probes/cliphub_navigation_contract_probe_066.js.
 * Probe065 had a control_ack write/read race: FileOutputStream creates the
 * acknowledgement file before JSON bytes are fully written, while Probe065
 * treated file existence as readiness and could call JSON.parse("").
 * Kept as a small compatibility marker so old links fail clearly instead of
 * producing a misleading runtime result. Rhino ES5 only.
 */
(function (global) {
    global.ClipHubNavigationContractProbe065Result = {
        ok: false,
        probe: "cliphub_navigation_contract_probe_065",
        probeVersion: 3,
        phase: "deprecated",
        classification: "USE_PROBE_066",
        error: "Probe065 is deprecated because its control_ack reader can race an empty file. Use cliphub_navigation_contract_probe_066.js."
    };
}((function () { return this; }())));

JSON.stringify(ClipHubNavigationContractProbe065Result);
