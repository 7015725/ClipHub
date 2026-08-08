/* ClipHub Stage 16B.1 safe Holder rebind ES5 loader. */
(function (global) {
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var FOS = Packages.java.io.FileOutputStream;
    var BAOS = Packages.java.io.ByteArrayOutputStream;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var JavaString = Packages.java.lang.String;
    var URL = Packages.java.net.URL;
    var MessageDigest = Packages.java.security.MessageDigest;

    var BASE_URL =
        "https://raw.githubusercontent.com/7015725/ClipHub/" +
        "338a811e538ab526b59eed05102d4f4b66f19953/" +
        "src/ch_11_filter.js";
    var BASE_BLOB_SHA1 = "160cbf0aa482868042c89dad33eae990ccd93488";
    var CACHE_NAME = "ch_11_filter_stage16b_baseline_loader.js";

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }

    function readBytes(stream) {
        var output = new BAOS();
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);
        var count;
        try {
            while ((count = stream.read(buffer)) >= 0) {
                if (count > 0) { output.write(buffer, 0, count); }
            }
            return output.toByteArray();
        } finally {
            closeQuietly(stream);
            closeQuietly(output);
        }
    }

    function readUtf8(file) {
        return String(new JavaString(readBytes(new FIS(file)), "UTF-8"));
    }

    function ensureDir(dir) {
        if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new Error("Cannot create directory: " +
                String(dir.getAbsolutePath()));
        }
        return dir;
    }

    function writeUtf8Atomic(file, text) {
        var parent = ensureDir(file.getParentFile());
        var temp = new File(parent, file.getName() + ".tmp");
        var output = null;
        try {
            output = new FOS(temp, false);
            output.write(new JavaString(String(text)).getBytes("UTF-8"));
            output.flush();
        } finally {
            closeQuietly(output);
        }
        if (file.exists() && !file.delete()) {
            temp.delete();
            throw new Error("Cannot replace cache: " +
                String(file.getAbsolutePath()));
        }
        if (!temp.renameTo(file)) {
            temp.delete();
            throw new Error("Cannot commit cache: " +
                String(file.getAbsolutePath()));
        }
    }

    function gitBlobSha1(text) {
        var bytes = new JavaString(String(text)).getBytes("UTF-8");
        var header = new JavaString("blob " + bytes.length + "\u0000")
            .getBytes("UTF-8");
        var digest = MessageDigest.getInstance("SHA-1");
        var result;
        var parts = [];
        var index;
        var value;
        digest.update(header);
        digest.update(bytes);
        result = digest.digest();
        for (index = 0; index < result.length; index += 1) {
            value = Number(result[index]);
            if (value < 0) { value += 256; }
            parts.push((value < 16 ? "0" : "") + value.toString(16));
        }
        return parts.join("");
    }

    function runtimeName() {
        var options = global.ClipHubBootstrapOptions || {};
        var name = options.runtimeName === undefined ?
            "ClipHub" : String(options.runtimeName);
        if (!/^[A-Za-z0-9._-]+$/.test(name) ||
                name === "." || name === "..") {
            throw new Error("Invalid runtime name: " + name);
        }
        return name;
    }

    function fetchBaseline() {
        var connection = null;
        var code;
        var text;
        try {
            connection = new URL(BASE_URL + "?stage16b1v14=" +
                Number(Packages.java.lang.System.currentTimeMillis()))
                .openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(30000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept-Encoding", "identity");
            code = Number(connection.getResponseCode());
            text = String(new JavaString(readBytes(
                code >= 200 && code < 300 ?
                    connection.getInputStream() :
                    connection.getErrorStream()), "UTF-8"));
            if (code < 200 || code >= 300) {
                throw new Error("HTTP " + code + " baseline loader");
            }
            return text;
        } finally {
            if (connection !== null) {
                try { connection.disconnect(); } catch (ignoredDisconnect) {}
            }
        }
    }

    function loadBaseline() {
        var root;
        var cacheFile;
        var text = "";
        if (typeof shortx === "undefined" ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("ShortX runtime unavailable");
        }
        root = new File(String(shortx.getShortXDir()));
        cacheFile = new File(ensureDir(new File(
            new File(root, runtimeName()), "cache")), CACHE_NAME);
        if (cacheFile.isFile()) {
            try {
                text = readUtf8(cacheFile);
                if (gitBlobSha1(text) === BASE_BLOB_SHA1) {
                    return text;
                }
            } catch (ignoredCache) {}
        }
        text = fetchBaseline();
        if (gitBlobSha1(text) !== BASE_BLOB_SHA1) {
            throw new Error("Stage 16B baseline loader SHA mismatch");
        }
        writeUtf8Atomic(cacheFile, text);
        return text;
    }

    function replaceOnce(text, oldText, newText, label) {
        var first = text.indexOf(oldText);
        if (first < 0) {
            throw new Error("Stage 16B.1 anchor missing: " + label);
        }
        if (text.indexOf(oldText, first + oldText.length) >= 0) {
            throw new Error("Stage 16B.1 anchor duplicate: " + label);
        }
        return text.substring(0, first) + newText +
            text.substring(first + oldText.length);
    }

    function transformBaselineLoader(loader) {
        var patch =
'    function transformRecycleFixSource(source) {\n' +
'        var info;\n' +
'        var value;\n' +
'        source = replaceOnceStrict(source,\n' +
'            "MODULE_VERSION: 59", "MODULE_VERSION: 60",\n' +
'            "Stage16B1 module version");\n' +
'        source = replaceOnceStrict(source,\n' +
'            "        holderNewBuildCount: 0\\n",\n' +
'            "        holderNewBuildCount: 0,\\n" +\n' +
'            "        holderRebindAttemptCount: 0,\\n" +\n' +
'            "        holderRebindEligibleCount: 0,\\n" +\n' +
'            "        holderRebindIneligibleCount: 0,\\n" +\n' +
'            "        holderRebindFailureCount: 0,\\n" +\n' +
'            "        holderRebindLastRejectReason: \\"\\",\\n" +\n' +
'            "        holderRebindLastFailureStage: \\"\\",\\n" +\n' +
'            "        holderRebindLastError: \\"\\",\\n" +\n' +
'            "        holderRebindRejectReasons: {},\\n" +\n' +
'            "        holderRebindFailureStages: {}\\n",\n' +
'            "Stage16B1 metrics");\n' +
'        source = replaceOnceStrict(source,\n' +
'            "        scrollPerformanceState.holderNewBuildCount = 0;\\n",\n' +
'            "        scrollPerformanceState.holderNewBuildCount = 0;\\n" +\n' +
'            "        scrollPerformanceState.holderRebindAttemptCount = 0;\\n" +\n' +
'            "        scrollPerformanceState.holderRebindEligibleCount = 0;\\n" +\n' +
'            "        scrollPerformanceState.holderRebindIneligibleCount = 0;\\n" +\n' +
'            "        scrollPerformanceState.holderRebindFailureCount = 0;\\n" +\n' +
'            "        scrollPerformanceState.holderRebindLastRejectReason = \\"\\";\\n" +\n' +
'            "        scrollPerformanceState.holderRebindLastFailureStage = \\"\\";\\n" +\n' +
'            "        scrollPerformanceState.holderRebindLastError = \\"\\";\\n" +\n' +
'            "        scrollPerformanceState.holderRebindRejectReasons = {};\\n" +\n' +
'            "        scrollPerformanceState.holderRebindFailureStages = {};\\n",\n' +
'            "Stage16B1 metric reset");\n' +
'        source = replaceOnceStrict(source,\n' +
'            "            holderNewBuildCount:\\n" +\n' +
'            "                Number(scrollPerformanceState.holderNewBuildCount),\\n" +\n' +
'            "            pendingOrigin: virtualPendingOrigin,\\n",\n' +
'            "            holderNewBuildCount:\\n" +\n' +
'            "                Number(scrollPerformanceState.holderNewBuildCount),\\n" +\n' +
'            "            holderRebindAttemptCount:\\n" +\n' +
'            "                Number(scrollPerformanceState.holderRebindAttemptCount),\\n" +\n' +
'            "            holderRebindEligibleCount:\\n" +\n' +
'            "                Number(scrollPerformanceState.holderRebindEligibleCount),\\n" +\n' +
'            "            holderRebindIneligibleCount:\\n" +\n' +
'            "                Number(scrollPerformanceState.holderRebindIneligibleCount),\\n" +\n' +
'            "            holderRebindFailureCount:\\n" +\n' +
'            "                Number(scrollPerformanceState.holderRebindFailureCount),\\n" +\n' +
'            "            holderRebindLastRejectReason:\\n" +\n' +
'            "                String(scrollPerformanceState.holderRebindLastRejectReason || \\"\\"),\\n" +\n' +
'            "            holderRebindLastFailureStage:\\n" +\n' +
'            "                String(scrollPerformanceState.holderRebindLastFailureStage || \\"\\"),\\n" +\n' +
'            "            holderRebindLastError:\\n" +\n' +
'            "                String(scrollPerformanceState.holderRebindLastError || \\"\\"),\\n" +\n' +
'            "            holderRebindRejectReasons:\\n" +\n' +
'            "                scrollPerformanceState.holderRebindRejectReasons,\\n" +\n' +
'            "            holderRebindFailureStages:\\n" +\n' +
'            "                scrollPerformanceState.holderRebindFailureStages,\\n" +\n' +
'            "            pendingOrigin: virtualPendingOrigin,\\n",\n' +
'            "Stage16B1 metric copy");\n' +
'        info = section(source,\n' +
'            "    function rebindResultCardHolder(holder, row, colors) {",\n' +
'            "\\n    function makeResultCard(",\n' +
'            "Stage16B1 rebind function");\n' +
'        value =\n' +
'            "    function noteCardHolderRebindReason(map, reason) {\\n" +\n' +
'            "        var key = String(reason || \\"unknown\\");\\n" +\n' +
'            "        if (map[key] === undefined || map[key] === null) { map[key] = 0; }\\n" +\n' +
'            "        map[key] = Number(map[key]) + 1;\\n" +\n' +
'            "        return key;\\n" +\n' +
'            "    }\\n\\n" +\n' +
'            "    function rebindResultCardHolder(holder, row, colors) {\\n" +\n' +
'            "        var startedAt = Number(System.currentTimeMillis());\\n" +\n' +
'            "        var elapsed;\\n" +\n' +
'            "        var stage = \\"validate\\";\\n" +\n' +
'            "        var oldRow;\\n" +\n' +
'            "        var oldTags;\\n" +\n' +
'            "        var newTags;\\n" +\n' +
'            "        var oldSelected;\\n" +\n' +
'            "        var newSelected;\\n" +\n' +
'            "        var oldPinned;\\n" +\n' +
'            "        var newPinned;\\n" +\n' +
'            "        var oldPackage;\\n" +\n' +
'            "        var newPackage;\\n" +\n' +
'            "        var oldHasTags;\\n" +\n' +
'            "        var newHasTags;\\n" +\n' +
'            "        var reason = \\"\\";\\n" +\n' +
'            "        scrollPerformanceState.holderRebindAttemptCount += 1;\\n" +\n' +
'            "        if (holder === null || holder === undefined || row === null || row === undefined ||\\n" +\n' +
'            "                holder.row === null || holder.row === undefined ||\\n" +\n' +
'            "                holder.contentView === null || holder.contentView === undefined ||\\n" +\n' +
'            "                holder.tagBadge === null || holder.tagBadge === undefined ||\\n" +\n' +
'            "                holder.sourceView === null || holder.sourceView === undefined) {\\n" +\n' +
'            "            reason = noteCardHolderRebindReason(scrollPerformanceState.holderRebindRejectReasons, \\"invalid_holder\\");\\n" +\n' +
'            "            scrollPerformanceState.holderRebindIneligibleCount += 1;\\n" +\n' +
'            "            scrollPerformanceState.holderRebindLastRejectReason = reason;\\n" +\n' +
'            "            return false;\\n" +\n' +
'            "        }\\n" +\n' +
'            "        try {\\n" +\n' +
'            "            oldRow = holder.row;\\n" +\n' +
'            "            stage = \\"eligibility\\";\\n" +\n' +
'            "            oldSelected = holder.selected === true;\\n" +\n' +
'            "            newSelected = SELECTION_ENABLED && selectedItemId !== null && Number(selectedItemId) === Number(row.id);\\n" +\n' +
'            "            oldPinned = holder.pinned === true;\\n" +\n' +
'            "            newPinned = Number(row.is_pinned || 0) === 1;\\n" +\n' +
'            "            oldPackage = String(holder.sourcePackage || oldRow.source_package || \\"\\");\\n" +\n' +
'            "            newPackage = String(row.source_package || \\"\\");\\n" +\n' +
'            "            oldTags = tagsForResult(oldRow);\\n" +\n' +
'            "            newTags = tagsForResult(row);\\n" +\n' +
'            "            oldHasTags = oldTags.length > 0;\\n" +\n' +
'            "            newHasTags = newTags.length > 0;\\n" +\n' +
'            "            if (oldSelected !== newSelected) { reason = \\"selected_changed\\"; }\\n" +\n' +
'            "            else if (oldPinned !== newPinned) { reason = \\"pinned_changed\\"; }\\n" +\n' +
'            "            else if (oldPackage !== newPackage) { reason = \\"source_package_changed\\"; }\\n" +\n' +
'            "            else if (oldHasTags !== newHasTags) { reason = \\"tag_presence_changed\\"; }\\n" +\n' +
'            "            if (reason.length > 0) {\\n" +\n' +
'            "                reason = noteCardHolderRebindReason(scrollPerformanceState.holderRebindRejectReasons, reason);\\n" +\n' +
'            "                scrollPerformanceState.holderRebindIneligibleCount += 1;\\n" +\n' +
'            "                scrollPerformanceState.holderRebindLastRejectReason = reason;\\n" +\n' +
'            "                return false;\\n" +\n' +
'            "            }\\n" +\n' +
'            "            scrollPerformanceState.holderRebindEligibleCount += 1;\\n" +\n' +
'            "            stage = \\"content_text\\";\\n" +\n' +
'            "            holder.contentView.setText(String(resultPreviewText(row)));\\n" +\n' +
'            "            stage = \\"tag_text\\";\\n" +\n' +
'            "            holder.tagBadge.setText(String((newTags.length > 0 ? \\"●  \\" : \\"\\") + tagSummary(newTags)));\\n" +\n' +
'            "            stage = \\"tag_color\\";\\n" +\n' +
'            "            holder.tagBadge.setTextColor(newTags.length > 0 ? tagColorText(newTags[0], colors.accentStrong) : colors.textTertiary);\\n" +\n' +
'            "            stage = \\"source_text\\";\\n" +\n' +
'            "            holder.sourceView.setText(String(sourceLabel(row) + \\" · \\" + formatTime(row.last_copied_at)));\\n" +\n' +
'            "            stage = \\"commit\\";\\n" +\n' +
'            "            holder.row = row; holder.itemId = Number(row.id);\\n" +\n' +
'            "            holder.selected = newSelected; holder.pinned = newPinned; holder.sourcePackage = newPackage;\\n" +\n' +
'            "            elapsed = Math.max(0, Number(System.currentTimeMillis()) - startedAt);\\n" +\n' +
'            "            scrollPerformanceState.holderRebindCount += 1;\\n" +\n' +
'            "            scrollPerformanceState.holderRebindLastMs = elapsed;\\n" +\n' +
'            "            scrollPerformanceState.holderRebindMaxMs = Math.max(Number(scrollPerformanceState.holderRebindMaxMs), elapsed);\\n" +\n' +
'            "            return true;\\n" +\n' +
'            "        } catch (error) {\\n" +\n' +
'            "            scrollPerformanceState.holderRebindFailureCount += 1;\\n" +\n' +
'            "            scrollPerformanceState.holderRebindLastFailureStage = noteCardHolderRebindReason(scrollPerformanceState.holderRebindFailureStages, stage);\\n" +\n' +
'            "            scrollPerformanceState.holderRebindLastError = String(error);\\n" +\n' +
'            "            virtualState.lastError = \\"CardHolder rebind failed at \\" + stage + \": \\" + String(error);\\n" +\n' +
'            "            return false;\\n" +\n' +
'            "        }\\n" +\n' +
'            "    }\\n";\n' +
'        source = replaceSection(source, info, value);\n' +
'        if (source.indexOf("MODULE_VERSION: 60") < 0 ||\n' +
'                source.indexOf("holderRebindAttemptCount") < 0 ||\n' +
'                source.indexOf("holderRebindFailureStages") < 0 ||\n' +
'                source.indexOf("holder.contentView.setText(String(resultPreviewText(row)))") < 0) {\n' +
'            throw new Error("Stage16B1 safe rebind wiring incomplete");\n' +
'        }\n' +
'        return source;\n' +
'    }\n\n';

        loader = replaceOnce(loader,
            '    try {\n' +
            '        eval(transformRecycleSource(\n' +
            '            transformCardHolderSource(\n' +
            '                transformSource(decodeSource(loadPackedSource())))));\n',
            patch +
            '    try {\n' +
            '        eval(transformRecycleFixSource(\n' +
            '            transformRecycleSource(\n' +
            '                transformCardHolderSource(\n' +
            '                    transformSource(decodeSource(loadPackedSource()))))));\n',
            "baseline eval");
        loader = loader.replace(
            "ch_11_filter.js Stage 16B loader failed:",
            "ch_11_filter.js Stage 16B.1 loader failed:");
        return loader;
    }

    try {
        eval(transformBaselineLoader(loadBaseline()));
    } catch (error) {
        throw new Error("ch_11_filter.js Stage 16B.1 wrapper failed: " +
            String(error));
    }
}((function () { return this; }())));
