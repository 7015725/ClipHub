// ClipHub 阶段 1 视觉探测脚本 001
// ShortX / Rhino ES5
// 作用：从 beta 分支加载 ClipHub.js，并固定打开首页视觉基线。

var CLIPHUB_COMMAND = "show";
var CLIPHUB_PROBE_URL = "https://raw.githubusercontent.com/7015725/ClipHub/beta/ClipHub.js" +
    "?_probe_ts=" + java.lang.System.currentTimeMillis();

function probeCloseQuietly(resource) {
    try {
        if (resource) resource.close();
    } catch (eClose) {}
}

function probeDownloadUtf8(urlText) {
    var connection = null;
    var input = null;
    var reader = null;
    try {
        connection = new java.net.URL(String(urlText)).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        try {
            connection.setRequestProperty("User-Agent", "ClipHub-Visual-Probe/001");
        } catch (eHeader) {}
        connection.connect();
        input = connection.getInputStream();
        reader = new java.io.BufferedReader(new java.io.InputStreamReader(input, "UTF-8"));
        var builder = new java.lang.StringBuilder();
        var line = null;
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        var text = String(builder.toString());
        if (!text) throw new Error("ClipHub.js 下载结果为空");
        return text;
    } finally {
        probeCloseQuietly(reader);
        probeCloseQuietly(input);
        try {
            if (connection && connection.disconnect) connection.disconnect();
        } catch (eDisconnect) {}
    }
}

var probeStartedAt = Number(java.lang.System.currentTimeMillis());
var entrySource = probeDownloadUtf8(CLIPHUB_PROBE_URL);
var entryResult = eval(entrySource + "\n//# sourceURL=ClipHub/ClipHub.js");

JSON.stringify({
    ok: true,
    probe: "cliphub_stage1_visual_probe_001",
    probeVersion: 1,
    startedAt: probeStartedAt,
    branch: "beta",
    scene: "home_list_light",
    visualScreenshotRequired: true,
    expected: {
        title: "全局剪切板",
        itemCountText: "共 23 条",
        selectedPhoneItem: true,
        bottomActions: 5
    },
    entryResult: String(entryResult || "")
});
