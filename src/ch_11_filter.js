/* ClipHub Stage 16B overlap Holder recycle ES5 loader. */
(function (global) {
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var FOS = Packages.java.io.FileOutputStream;
    var BAIS = Packages.java.io.ByteArrayInputStream;
    var BAOS = Packages.java.io.ByteArrayOutputStream;
    var GZIPInputStream = Packages.java.util.zip.GZIPInputStream;
    var Base64 = Packages.android.util.Base64;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var JavaString = Packages.java.lang.String;
    var URL = Packages.java.net.URL;
    var URLEncoder = Packages.java.net.URLEncoder;
    var MessageDigest = Packages.java.security.MessageDigest;
    var System = Packages.java.lang.System;

    var REF = "beta-pagination-stage10-20260808";
    var PARTS = [
        "stage-assets/pagination-stage9/ch11_full_v8s_00.b64",
        "stage-assets/pagination-stage9/ch11_full_v8s_01.b64",
        "stage-assets/pagination-stage9/ch11_full_v8s_02.b64",
        "stage-assets/pagination-stage9/ch11_full_v8s_03.b64",
        "stage-assets/pagination-stage9/ch11_full_v8s_04.b64",
        "stage-assets/pagination-stage9/ch11_full_v8s_05.b64",
        "stage-assets/pagination-stage9/ch11_full_v8s_06.b64",
        "stage-assets/pagination-stage9/ch11_full_v8s_07.b64"
    ];
    var PACKED_SHA256 =
        "2c458cba6993be764e6763c9e09228f665520b1218ec038df453bd91f25ad294";
    var SOURCE_SHA256 =
        "328608b7fa357c9262079f43289d692ea7ddf79d9416e6135023d55f4bff6940";
    var CACHE_NAME = "ch_11_filter_stage14_v10_noop_layout_full.b64";

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
        return String(new JavaString(
            readBytes(new FIS(file)), "UTF-8"));
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
            output.write(new JavaString(String(text))
                .getBytes("UTF-8"));
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

    function sha256(text) {
        var digest = MessageDigest.getInstance("SHA-256");
        var bytes = digest.digest(new JavaString(String(text))
            .getBytes("UTF-8"));
        var parts = [];
        var index;
        var value;
        for (index = 0; index < bytes.length; index += 1) {
            value = Number(bytes[index]);
            if (value < 0) { value += 256; }
            parts.push((value < 16 ? "0" : "") +
                value.toString(16));
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

    function encodePath(path) {
        return String(URLEncoder.encode(String(path), "UTF-8"))
            .replace(/%2F/g, "/").replace(/\+/g, "%20");
    }

    function fetchPart(path) {
        var connection = null;
        var code;
        var text;
        try {
            connection = new URL(
                "https://raw.githubusercontent.com/7015725/ClipHub/" +
                encodePath(REF) + "/" + encodePath(path) +
                "?stage16bv13=" + Number(System.currentTimeMillis())
            ).openConnection();
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
                throw new Error("HTTP " + code + " " + path);
            }
            return text;
        } finally {
            if (connection !== null) {
                try { connection.disconnect(); } catch (ignored) {}
            }
        }
    }

    function loadPackedSource() {
        var root;
        var runtimeDir;
        var cacheFile;
        var packed = "";
        var index;
        if (typeof shortx === "undefined" ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("ShortX runtime unavailable");
        }
        root = new File(String(shortx.getShortXDir()));
        runtimeDir = new File(root, runtimeName());
        cacheFile = new File(
            ensureDir(new File(runtimeDir, "cache")), CACHE_NAME);
        if (cacheFile.isFile()) {
            try {
                packed = readUtf8(cacheFile).replace(/\s+/g, "");
                if (sha256(packed) === PACKED_SHA256) {
                    return packed;
                }
            } catch (ignoredCache) {}
        }
        packed = "";
        for (index = 0; index < PARTS.length; index += 1) {
            packed += fetchPart(PARTS[index]);
        }
        packed = packed.replace(/\s+/g, "");
        if (sha256(packed) !== PACKED_SHA256) {
            throw new Error("Stage 15 packed source SHA-256 mismatch");
        }
        writeUtf8Atomic(cacheFile, packed);
        return packed;
    }

    function decodeSource(packed) {
        var input = new GZIPInputStream(new BAIS(
            Base64.decode(String(packed), Base64.DEFAULT)));
        var source = String(new JavaString(
            readBytes(input), "UTF-8"));
        if (sha256(source) !== SOURCE_SHA256) {
            throw new Error("Stage 15 source SHA-256 mismatch");
        }
        return source;
    }

    function replaceOnceStrict(text, oldText, newText, label) {
        var first = text.indexOf(oldText);
        if (first < 0) {
            throw new Error("Stage 15 anchor missing: " + label);
        }
        if (text.indexOf(oldText, first + oldText.length) >= 0) {
            throw new Error("Stage 15 anchor duplicate: " + label);
        }
        return text.substring(0, first) + newText +
            text.substring(first + oldText.length);
    }

    function section(text, startMarker, endMarker, label) {
        var start = text.indexOf(startMarker);
        var end;
        if (start < 0) {
            throw new Error("Stage 15 section missing: " + label);
        }
        end = text.indexOf(endMarker, start + startMarker.length);
        if (end < 0) {
            throw new Error("Stage 15 section end missing: " + label);
        }
        return {
            start: start,
            end: end,
            text: text.substring(start, end)
        };
    }

    function replaceSection(text, info, value) {
        return text.substring(0, info.start) + value +
            text.substring(info.end);
    }

    function transformSource(source) {
        var info;
        var value;
        var pos;

        source = replaceOnceStrict(source,
            "MODULE_VERSION: 56", "MODULE_VERSION: 57",
            "module version");

        source = replaceOnceStrict(source,
            "        measureMaxMs: 0\n",
            "        measureMaxMs: 0,\n" +
            "        keyedReconcileLastMs: 0,\n" +
            "        keyedReconcileMaxMs: 0,\n" +
            "        keyedSignatureLastMs: 0,\n" +
            "        keyedSignatureMaxMs: 0,\n" +
            "        keyedStructureLastMs: 0,\n" +
            "        keyedStructureMaxMs: 0,\n" +
            "        overlapUpdateLastMs: 0,\n" +
            "        overlapUpdateMaxMs: 0,\n" +
            "        slowRebuildCount: 0,\n" +
            "        slowRebuildSamples: []\n",
            "diagnostic metrics");

        source = replaceOnceStrict(source,
            "        scrollPerformanceState.measureMaxMs = 0;\n",
            "        scrollPerformanceState.measureMaxMs = 0;\n" +
            "        scrollPerformanceState.keyedReconcileLastMs = 0;\n" +
            "        scrollPerformanceState.keyedReconcileMaxMs = 0;\n" +
            "        scrollPerformanceState.keyedSignatureLastMs = 0;\n" +
            "        scrollPerformanceState.keyedSignatureMaxMs = 0;\n" +
            "        scrollPerformanceState.keyedStructureLastMs = 0;\n" +
            "        scrollPerformanceState.keyedStructureMaxMs = 0;\n" +
            "        scrollPerformanceState.overlapUpdateLastMs = 0;\n" +
            "        scrollPerformanceState.overlapUpdateMaxMs = 0;\n" +
            "        scrollPerformanceState.slowRebuildCount = 0;\n" +
            "        scrollPerformanceState.slowRebuildSamples = [];\n",
            "diagnostic reset");

        source = replaceOnceStrict(source,
            "            measureMaxMs:\n" +
            "                Number(scrollPerformanceState.measureMaxMs),\n" +
            "            pendingOrigin: virtualPendingOrigin,\n",
            "            measureMaxMs:\n" +
            "                Number(scrollPerformanceState.measureMaxMs),\n" +
            "            keyedReconcileLastMs:\n" +
            "                Number(scrollPerformanceState.keyedReconcileLastMs),\n" +
            "            keyedReconcileMaxMs:\n" +
            "                Number(scrollPerformanceState.keyedReconcileMaxMs),\n" +
            "            keyedSignatureLastMs:\n" +
            "                Number(scrollPerformanceState.keyedSignatureLastMs),\n" +
            "            keyedSignatureMaxMs:\n" +
            "                Number(scrollPerformanceState.keyedSignatureMaxMs),\n" +
            "            keyedStructureLastMs:\n" +
            "                Number(scrollPerformanceState.keyedStructureLastMs),\n" +
            "            keyedStructureMaxMs:\n" +
            "                Number(scrollPerformanceState.keyedStructureMaxMs),\n" +
            "            overlapUpdateLastMs:\n" +
            "                Number(scrollPerformanceState.overlapUpdateLastMs),\n" +
            "            overlapUpdateMaxMs:\n" +
            "                Number(scrollPerformanceState.overlapUpdateMaxMs),\n" +
            "            slowRebuildCount:\n" +
            "                Number(scrollPerformanceState.slowRebuildCount),\n" +
            "            slowRebuildSamples:\n" +
            "                scrollPerformanceState.slowRebuildSamples.slice(0),\n" +
            "            pendingOrigin: virtualPendingOrigin,\n",
            "diagnostic copy");

        info = section(source,
            "    function keyedReconcileVirtualWindow(range, colors) {",
            "\n    function ",
            "keyed reconcile");
        value = info.text;
        value = replaceOnceStrict(value,
            "    function keyedReconcileVirtualWindow(range, colors) {\n",
            "    function keyedReconcileVirtualWindow(range, colors) {\n" +
            "        var keyedStartedAt = Number(System.currentTimeMillis());\n" +
            "        var keyedSignatureStartedAt;\n" +
            "        var keyedStructureStartedAt;\n" +
            "        var keyedElapsed;\n" +
            "        var keyedSignatureElapsed;\n" +
            "        var keyedStructureElapsed;\n",
            "keyed vars");
        value = replaceOnceStrict(value,
            "        for (index = range.start; index <= range.end; index += 1) {\n",
            "        keyedSignatureStartedAt = Number(System.currentTimeMillis());\n" +
            "        for (index = range.start; index <= range.end; index += 1) {\n",
            "keyed signature start");
        value = replaceOnceStrict(value,
            "        for (localIndex = Number(virtualCardHost.getChildCount()) - 1;\n",
            "        keyedSignatureElapsed = Math.max(0,\n" +
            "            Number(System.currentTimeMillis()) - keyedSignatureStartedAt);\n" +
            "        keyedStructureStartedAt = Number(System.currentTimeMillis());\n" +
            "        for (localIndex = Number(virtualCardHost.getChildCount()) - 1;\n",
            "keyed structure start");
        pos = value.lastIndexOf("        return true;");
        if (pos < 0) {
            throw new Error("Stage 15 keyed return missing");
        }
        value = value.substring(0, pos) +
            "        keyedStructureElapsed = Math.max(0,\n" +
            "            Number(System.currentTimeMillis()) - keyedStructureStartedAt);\n" +
            "        keyedElapsed = Math.max(0,\n" +
            "            Number(System.currentTimeMillis()) - keyedStartedAt);\n" +
            "        scrollPerformanceState.keyedReconcileLastMs = keyedElapsed;\n" +
            "        scrollPerformanceState.keyedReconcileMaxMs = Math.max(\n" +
            "            Number(scrollPerformanceState.keyedReconcileMaxMs), keyedElapsed);\n" +
            "        scrollPerformanceState.keyedSignatureLastMs = keyedSignatureElapsed;\n" +
            "        scrollPerformanceState.keyedSignatureMaxMs = Math.max(\n" +
            "            Number(scrollPerformanceState.keyedSignatureMaxMs), keyedSignatureElapsed);\n" +
            "        scrollPerformanceState.keyedStructureLastMs = keyedStructureElapsed;\n" +
            "        scrollPerformanceState.keyedStructureMaxMs = Math.max(\n" +
            "            Number(scrollPerformanceState.keyedStructureMaxMs), keyedStructureElapsed);\n" +
            "        return true;" +
            value.substring(pos + "        return true;".length);
        source = replaceSection(source, info, value);

        info = section(source,
            "    function rebuildVirtualWindow(origin, force, preferredIndex) {",
            "\n    function scheduleVirtualUpdate(",
            "rebuild");
        value = info.text;
        value = replaceOnceStrict(value,
            "        var recycledCount;\n",
            "        var recycledCount;\n" +
            "        var rebuildCreatedBefore;\n" +
            "        var rebuildRemovedBefore;\n" +
            "        var rebuildReusedBefore;\n" +
            "        var overlapStartedAt;\n" +
            "        var overlapElapsed = 0;\n",
            "rebuild vars");
        value = replaceOnceStrict(value,
            "        var viewRebuildStartedAt =\n" +
            "            Number(System.currentTimeMillis());\n",
            "        var viewRebuildStartedAt =\n" +
            "            Number(System.currentTimeMillis());\n" +
            "        rebuildCreatedBefore = Number(scrollPerformanceState.createdViewCount);\n" +
            "        rebuildRemovedBefore = Number(scrollPerformanceState.removedViewCount);\n" +
            "        rebuildReusedBefore = Number(scrollPerformanceState.sameIdReuseCount);\n",
            "rebuild counters");
        value = replaceOnceStrict(value,
            "        if (overlap) {\n",
            "        if (overlap) {\n" +
            "            overlapStartedAt = Number(System.currentTimeMillis());\n",
            "overlap start");
        value = replaceOnceStrict(value,
            "            state.resultCardCount = Number(\n" +
            "                virtualCardHost.getChildCount());\n" +
            "        } else {\n",
            "            state.resultCardCount = Number(\n" +
            "                virtualCardHost.getChildCount());\n" +
            "            overlapElapsed = Math.max(0,\n" +
            "                Number(System.currentTimeMillis()) - overlapStartedAt);\n" +
            "            scrollPerformanceState.overlapUpdateLastMs = overlapElapsed;\n" +
            "            scrollPerformanceState.overlapUpdateMaxMs = Math.max(\n" +
            "                Number(scrollPerformanceState.overlapUpdateMaxMs), overlapElapsed);\n" +
            "        } else {\n",
            "overlap elapsed");
        value = replaceOnceStrict(value,
            "        scrollPerformanceState.viewRebuildMaxMs = Math.max(\n" +
            "            Number(scrollPerformanceState.viewRebuildMaxMs),\n" +
            "            viewRebuildElapsed);\n",
            "        scrollPerformanceState.viewRebuildMaxMs = Math.max(\n" +
            "            Number(scrollPerformanceState.viewRebuildMaxMs),\n" +
            "            viewRebuildElapsed);\n" +
            "        if (viewRebuildElapsed > 32) {\n" +
            "            scrollPerformanceState.slowRebuildCount += 1;\n" +
            "            scrollPerformanceState.slowRebuildSamples.push({\n" +
            "                origin: String(origin || \"virtual_rebuild\"),\n" +
            "                force: force === true,\n" +
            "                mode: overlap ? \"overlap\" : \"keyed\",\n" +
            "                elapsedMs: viewRebuildElapsed,\n" +
            "                rangeStart: Number(range.start),\n" +
            "                rangeEnd: Number(range.end),\n" +
            "                oldCount: oldCount,\n" +
            "                newCount: Number(virtualCardHost.getChildCount()),\n" +
            "                created: Number(scrollPerformanceState.createdViewCount) -\n" +
            "                    rebuildCreatedBefore,\n" +
            "                removed: Number(scrollPerformanceState.removedViewCount) -\n" +
            "                    rebuildRemovedBefore,\n" +
            "                reused: Number(scrollPerformanceState.sameIdReuseCount) -\n" +
            "                    rebuildReusedBefore,\n" +
            "                measureMs: Number(scrollPerformanceState.measureLastMs),\n" +
            "                keyedMs: overlap ? 0 :\n" +
            "                    Number(scrollPerformanceState.keyedReconcileLastMs),\n" +
            "                signatureMs: overlap ? 0 :\n" +
            "                    Number(scrollPerformanceState.keyedSignatureLastMs),\n" +
            "                structureMs: overlap ? overlapElapsed :\n" +
            "                    Number(scrollPerformanceState.keyedStructureLastMs)\n" +
            "            });\n" +
            "            while (scrollPerformanceState.slowRebuildSamples.length > 8) {\n" +
            "                scrollPerformanceState.slowRebuildSamples.shift();\n" +
            "            }\n" +
            "        }\n",
            "slow rebuild sample");
        source = replaceSection(source, info, value);

        if (source.indexOf("var VIRTUAL_BEFORE_SCREENS = 3;") < 0 ||
                source.indexOf("var VIRTUAL_AFTER_SCREENS = 5;") < 0 ||
                source.indexOf("var VIRTUAL_UPDATE_DELAY_MS = 24;") < 0 ||
                source.indexOf("sameRangeNoLayoutCount") < 0 ||
                source.indexOf("spacerNoopCount") < 0 ||
                source.indexOf("anchorScrollNoopCount") < 0) {
            throw new Error("Stage 15 frozen invariant missing");
        }
        if (source.indexOf("resultTagBadgeViews") >= 0 ||
                source.indexOf("refreshRenderedTagBadges") >= 0) {
            throw new Error("Stage 15 unsafe Filter53 code detected");
        }
        return source;
    }


    function transformCardHolderSource(source) {
        var info;
        var value;

        source = replaceOnceStrict(source,
  "MODULE_VERSION: 57", "MODULE_VERSION: 58",
  "Stage16A module version");

        source = replaceOnceStrict(source,
  "    function buildCardActionGrid(row, colors, metrics) {\n",
  "    function currentCardHolderRow(holder) {\n" +
  "        if (holder === null || holder === undefined ||\n" +
  "                holder.row === null || holder.row === undefined) {\n" +
  "            return null;\n" +
  "        }\n" +
  "        holder.itemId = Number(holder.row.id);\n" +
  "        return holder.row;\n" +
  "    }\n\n" +
  "    function buildCardActionGrid(holder, colors, metrics) {\n",
  "Stage16A holder helper");

        info = section(source,
  "    function buildCardActionGrid(holder, colors, metrics) {",
  "\n    function ",
  "Stage16A card actions");
        value = info.text;
        value = replaceOnceStrict(value,
  "                editResultRow(row, \"card_action_edit\");\n",
  "                editResultRow(currentCardHolderRow(holder),\n" +
  "                    \"card_action_edit\");\n",
  "Stage16A edit action");
        value = replaceOnceStrict(value,
  "                translateResultRow(row, \"card_action_translate\");\n",
  "                translateResultRow(currentCardHolderRow(holder),\n" +
  "                    \"card_action_translate\");\n",
  "Stage16A translate action");
        value = replaceOnceStrict(value,
  "                copyResultRow(row, \"card_action_copy\");\n",
  "                copyResultRow(currentCardHolderRow(holder),\n" +
  "                    \"card_action_copy\");\n",
  "Stage16A copy action");
        value = replaceOnceStrict(value,
  "                deleteResultRow(row, \"card_action_delete\");\n",
  "                deleteResultRow(currentCardHolderRow(holder),\n" +
  "                    \"card_action_delete\");\n",
  "Stage16A delete action");
        value = replaceOnceStrict(value,
  "        resultActionViews.push({\n" +
  "            edit: edit,\n" +
  "            translate: translate,\n" +
  "            copy: copy,\n" +
  "            delete: remove\n" +
  "        });\n",
  "        holder.editButton = edit;\n" +
  "        holder.translateButton = translate;\n" +
  "        holder.copyButton = copy;\n" +
  "        holder.deleteButton = remove;\n" +
  "        resultActionViews.push({\n" +
  "            edit: edit,\n" +
  "            translate: translate,\n" +
  "            copy: copy,\n" +
  "            delete: remove\n" +
  "        });\n",
  "Stage16A holder action refs");
        source = replaceSection(source, info, value);

        info = section(source,
  "    function bindSwipeGesture(row, wrapper, foreground, deleteAction,",
  "\n    function ",
  "Stage16A swipe binding");
        value = info.text;
        value = replaceOnceStrict(value,
  "    function bindSwipeGesture(row, wrapper, foreground, deleteAction,\n" +
  "            pinAction, metrics) {\n",
  "    function bindSwipeGesture(holder, wrapper, foreground, deleteAction,\n" +
  "            pinAction, metrics) {\n",
  "Stage16A swipe signature");
        value = replaceOnceStrict(value,
  "                            performSwipeAction(row, direction, foreground);\n",
  "                            performSwipeAction(\n" +
  "                                currentCardHolderRow(holder),\n" +
  "                                direction, foreground);\n",
  "Stage16A swipe action");
        source = replaceSection(source, info, value);

        info = section(source,
  "    function makeResultCard(row, colors) {",
  "\n    function ",
  "Stage16A result card");
        value = info.text;
        value = replaceOnceStrict(value,
  "        var actionGrid = buildCardActionGrid(row, colors, metrics);\n",
  "        var holder = {\n" +
  "            itemId: Number(row.id),\n" +
  "            row: row,\n" +
  "            wrapper: wrapper,\n" +
  "            actionLayer: actionLayer,\n" +
  "            deleteAction: deleteAction,\n" +
  "            pinAction: pinAction,\n" +
  "            card: card,\n" +
  "            iconView: icon,\n" +
  "            center: center,\n" +
  "            contentRow: contentRow,\n" +
  "            contentView: content,\n" +
  "            metaRow: metaRow,\n" +
  "            tagBadge: tagBadge,\n" +
  "            sourceView: source,\n" +
  "            pinBadge: null,\n" +
  "            actionGrid: null,\n" +
  "            selected: selected,\n" +
  "            pinned: pinned,\n" +
  "            metrics: metrics\n" +
  "        };\n" +
  "        var actionGrid = buildCardActionGrid(holder, colors, metrics);\n" +
  "        holder.actionGrid = actionGrid;\n",
  "Stage16A holder creation");
        value = replaceOnceStrict(value,
  "                onClick: function () { inputResultRow(row, \"card_click\"); }\n",
  "                onClick: function () {\n" +
  "                    inputResultRow(currentCardHolderRow(holder),\n" +
  "                        \"card_click\");\n" +
  "                }\n",
  "Stage16A card click");
        value = replaceOnceStrict(value,
  "            pinBadge = makePinnedBadge(colors, metrics);\n",
  "            pinBadge = makePinnedBadge(colors, metrics);\n" +
  "            holder.pinBadge = pinBadge;\n",
  "Stage16A pin badge ref");
        value = replaceOnceStrict(value,
  "        bindSwipeGesture(row, wrapper, card, deleteAction, pinAction, metrics);\n",
  "        bindSwipeGesture(holder, wrapper, card, deleteAction, pinAction, metrics);\n",
  "Stage16A swipe holder");
        source = replaceSection(source, info, value);

        if (source.indexOf("buildCardActionGrid(row, colors, metrics)") >= 0 ||
      source.indexOf("bindSwipeGesture(row, wrapper") >= 0 ||
      source.indexOf("inputResultRow(row, \"card_click\")") >= 0 ||
      source.indexOf("                            performSwipeAction(row, direction, foreground);") >= 0) {
  throw new Error("Stage16A stale row listener binding detected");
        }
        if (source.indexOf("function currentCardHolderRow(holder)") < 0 ||
      source.indexOf("var holder = {") < 0 ||
      source.indexOf("holder.editButton = edit;") < 0 ||
      source.indexOf("holder.pinBadge = pinBadge;") < 0) {
  throw new Error("Stage16A holder wiring incomplete");
        }
        return source;
    }


    function transformRecycleSource(source) {
        var info;
        var value;

        source = replaceOnceStrict(source,
  "MODULE_VERSION: 58", "MODULE_VERSION: 59",
  "Stage16B module version");

        source = replaceOnceStrict(source,
  "    var resultCardViews = [];\n",
  "    var resultCardViews = [];\n" +
  "    var resultCardHolders = [];\n",
  "Stage16B holder array declaration");

        source = source.replace(
  /^([ \t]*)resultCardViews = \[\];/gm,
  "$1resultCardViews = [];\n$1resultCardHolders = [];");

        source = replaceOnceStrict(source,
  "        slowRebuildSamples: []\n",
  "        slowRebuildSamples: [],\n" +
  "        holderRecycleReleaseCount: 0,\n" +
  "        holderRecycleReuseCount: 0,\n" +
  "        holderRecycleMissCount: 0,\n" +
  "        holderRecycleDiscardCount: 0,\n" +
  "        holderRebindCount: 0,\n" +
  "        holderRebindLastMs: 0,\n" +
  "        holderRebindMaxMs: 0,\n" +
  "        holderNewBuildCount: 0\n",
  "Stage16B recycle metrics");

        source = replaceOnceStrict(source,
  "        scrollPerformanceState.slowRebuildSamples = [];\n",
  "        scrollPerformanceState.slowRebuildSamples = [];\n" +
  "        scrollPerformanceState.holderRecycleReleaseCount = 0;\n" +
  "        scrollPerformanceState.holderRecycleReuseCount = 0;\n" +
  "        scrollPerformanceState.holderRecycleMissCount = 0;\n" +
  "        scrollPerformanceState.holderRecycleDiscardCount = 0;\n" +
  "        scrollPerformanceState.holderRebindCount = 0;\n" +
  "        scrollPerformanceState.holderRebindLastMs = 0;\n" +
  "        scrollPerformanceState.holderRebindMaxMs = 0;\n" +
  "        scrollPerformanceState.holderNewBuildCount = 0;\n",
  "Stage16B recycle metric reset");

        source = replaceOnceStrict(source,
  "            slowRebuildSamples:\n" +
  "                scrollPerformanceState.slowRebuildSamples.slice(0),\n" +
  "            pendingOrigin: virtualPendingOrigin,\n",
  "            slowRebuildSamples:\n" +
  "                scrollPerformanceState.slowRebuildSamples.slice(0),\n" +
  "            holderRecycleReleaseCount:\n" +
  "                Number(scrollPerformanceState.holderRecycleReleaseCount),\n" +
  "            holderRecycleReuseCount:\n" +
  "                Number(scrollPerformanceState.holderRecycleReuseCount),\n" +
  "            holderRecycleMissCount:\n" +
  "                Number(scrollPerformanceState.holderRecycleMissCount),\n" +
  "            holderRecycleDiscardCount:\n" +
  "                Number(scrollPerformanceState.holderRecycleDiscardCount),\n" +
  "            holderRebindCount:\n" +
  "                Number(scrollPerformanceState.holderRebindCount),\n" +
  "            holderRebindLastMs:\n" +
  "                Number(scrollPerformanceState.holderRebindLastMs),\n" +
  "            holderRebindMaxMs:\n" +
  "                Number(scrollPerformanceState.holderRebindMaxMs),\n" +
  "            holderNewBuildCount:\n" +
  "                Number(scrollPerformanceState.holderNewBuildCount),\n" +
  "            pendingOrigin: virtualPendingOrigin,\n",
  "Stage16B recycle metric copy");

        source = replaceOnceStrict(source,
  "    function makeResultCard(row, colors) {\n",
  "    function cardHolderActionRefs(holder) {\n" +
  "        return {\n" +
  "            edit: holder.editButton,\n" +
  "            translate: holder.translateButton,\n" +
  "            copy: holder.copyButton,\n" +
  "            delete: holder.deleteButton\n" +
  "        };\n" +
  "    }\n\n" +
  "    function replaceCardHolderChild(parent, oldView, newView) {\n" +
  "        var childIndex;\n" +
  "        var params;\n" +
  "        if (parent === null || parent === undefined ||\n" +
  "                oldView === null || oldView === undefined ||\n" +
  "                newView === null || newView === undefined) {\n" +
  "            return false;\n" +
  "        }\n" +
  "        childIndex = Number(parent.indexOfChild(oldView));\n" +
  "        if (childIndex < 0) { return false; }\n" +
  "        params = oldView.getLayoutParams();\n" +
  "        parent.removeViewAt(childIndex);\n" +
  "        parent.addView(newView, childIndex, params);\n" +
  "        return true;\n" +
  "    }\n\n" +
  "    function rebindResultCardHolder(holder, row, colors) {\n" +
  "        var startedAt = Number(System.currentTimeMillis());\n" +
  "        var elapsed;\n" +
  "        var selected;\n" +
  "        var pinned;\n" +
  "        var oldPinned;\n" +
  "        var metrics;\n" +
  "        var tags;\n" +
  "        var packageName;\n" +
  "        var replacement;\n" +
  "        var params;\n" +
  "        if (holder === null || holder === undefined ||\n" +
  "                row === null || row === undefined ||\n" +
  "                holder.wrapper === null || holder.card === null ||\n" +
  "                holder.contentView === null ||\n" +
  "                holder.tagBadge === null ||\n" +
  "                holder.sourceView === null) {\n" +
  "            return false;\n" +
  "        }\n" +
  "        try {\n" +
  "            metrics = holder.metrics || resultCardMetrics(0);\n" +
  "            selected = SELECTION_ENABLED && selectedItemId !== null &&\n" +
  "                Number(selectedItemId) === Number(row.id);\n" +
  "            pinned = Number(row.is_pinned || 0) === 1;\n" +
  "            oldPinned = holder.pinned === true;\n" +
  "            tags = tagsForResult(row);\n" +
  "            packageName = String(row.source_package || \"\");\n" +
  "            holder.row = row;\n" +
  "            holder.itemId = Number(row.id);\n" +
  "            holder.wrapper.setBackground(roundedBackground(\n" +
  "                colors.surfaceMuted, colors.stroke, 12));\n" +
  "            holder.card.setBackground(roundedBackground(\n" +
  "                selected ? colors.accentSoft : colors.card,\n" +
  "                selected ? colors.accentBorder : colors.stroke, 12));\n" +
  "            holder.card.setContentDescription((pinned ? \"已置顶，\" : \"\") +\n" +
  "                \"剪贴板记录，点击正文输入到当前文本框，左滑置顶，右滑删除，右侧提供编辑翻译复制删除图标\");\n" +
  "            if (holder.selected !== selected) {\n" +
  "                replacement = makeText(resultPreviewText(row),\n" +
  "                    metrics.contentTextSp, colors.textPrimary, selected);\n" +
  "                replacement.setMaxLines(2);\n" +
  "                replacement.setEllipsize(TextUtils.TruncateAt.END);\n" +
  "                if (!replaceCardHolderChild(holder.contentRow,\n" +
  "                        holder.contentView, replacement)) {\n" +
  "                    return false;\n" +
  "                }\n" +
  "                holder.contentView = replacement;\n" +
  "            } else {\n" +
  "                holder.contentView.setText(resultPreviewText(row));\n" +
  "            }\n" +
  "            holder.tagBadge.setText((tags.length > 0 ? \"●  \" : \"\") +\n" +
  "                tagSummary(tags));\n" +
  "            holder.tagBadge.setTextColor(tags.length > 0 ?\n" +
  "                tagColorText(tags[0], colors.accentStrong) :\n" +
  "                colors.textTertiary);\n" +
  "            try {\n" +
  "                holder.tagBadge.setTypeface(tags.length > 0 ?\n" +
  "                    Packages.android.graphics.Typeface.DEFAULT_BOLD :\n" +
  "                    Packages.android.graphics.Typeface.DEFAULT);\n" +
  "            } catch (ignoredTagTypeface) {}\n" +
  "            holder.tagBadge.setBackground(roundedBackground(\n" +
  "                tags.length > 0 ? colors.accentSoft : colors.surfaceMuted,\n" +
  "                null, metrics.actionRadiusDp));\n" +
  "            holder.sourceView.setText(sourceLabel(row) + \" · \" +\n" +
  "                formatTime(row.last_copied_at));\n" +
  "            if (String(holder.sourcePackage || \"\") !== packageName) {\n" +
  "                replacement = makeSourceIcon(row, colors);\n" +
  "                if (!replaceCardHolderChild(holder.card,\n" +
  "                        holder.iconView, replacement)) {\n" +
  "                    return false;\n" +
  "                }\n" +
  "                holder.iconView = replacement;\n" +
  "            }\n" +
  "            if (pinned && holder.pinBadge === null) {\n" +
  "                replacement = makePinnedBadge(colors, metrics);\n" +
  "                params = new LinearLayout.LayoutParams(\n" +
  "                    metrics.pinBadgeSizePx, metrics.pinBadgeSizePx);\n" +
  "                params.leftMargin = metrics.pinBadgeGapPx;\n" +
  "                holder.contentRow.addView(replacement, params);\n" +
  "                holder.pinBadge = replacement;\n" +
  "            } else if (!pinned && holder.pinBadge !== null) {\n" +
  "                holder.contentRow.removeView(holder.pinBadge);\n" +
  "                holder.pinBadge = null;\n" +
  "            }\n" +
  "            if (oldPinned !== pinned) {\n" +
  "                replacement = makeSwipeAction(\n" +
  "                    pinned ? \"取消置顶\" : \"置顶\",\n" +
  "                    colors.accentSoft, colors.accentStrong,\n" +
  "                    Gravity.END, metrics);\n" +
  "                if (!replaceCardHolderChild(holder.actionLayer,\n" +
  "                        holder.pinAction, replacement)) {\n" +
  "                    return false;\n" +
  "                }\n" +
  "                holder.pinAction = replacement;\n" +
  "            }\n" +
  "            holder.selected = selected;\n" +
  "            holder.pinned = pinned;\n" +
  "            holder.sourcePackage = packageName;\n" +
  "            elapsed = Math.max(0,\n" +
  "                Number(System.currentTimeMillis()) - startedAt);\n" +
  "            scrollPerformanceState.holderRebindCount += 1;\n" +
  "            scrollPerformanceState.holderRebindLastMs = elapsed;\n" +
  "            scrollPerformanceState.holderRebindMaxMs = Math.max(\n" +
  "                Number(scrollPerformanceState.holderRebindMaxMs), elapsed);\n" +
  "            return true;\n" +
  "        } catch (error) {\n" +
  "            virtualState.lastError = \"CardHolder rebind failed: \" +\n" +
  "                String(error);\n" +
  "            return false;\n" +
  "        }\n" +
  "    }\n\n" +
  "    function makeResultCard(row, colors) {\n",
  "Stage16B rebind helpers");

        info = section(source,
  "    function bindSwipeGesture(holder, wrapper, foreground, deleteAction,",
  "\n    function ",
  "Stage16B dynamic swipe refs");
        value = info.text;
        value = replaceOnceStrict(value,
  "                                    deleteAction: deleteAction,\n" +
  "                                    pinAction: pinAction\n",
  "                                    deleteAction: holder.deleteAction,\n" +
  "                                    pinAction: holder.pinAction\n",
  "Stage16B active swipe refs");
        value = replaceOnceStrict(value,
  "                        setSwipeVisual(foreground, deleteAction, pinAction,\n",
  "                        setSwipeVisual(foreground, holder.deleteAction,\n" +
  "                            holder.pinAction,\n",
  "Stage16B swipe visual refs");
        value = replaceOnceStrict(value,
  "                        resetSwipeVisual(foreground, deleteAction, pinAction,\n",
  "                        resetSwipeVisual(foreground, holder.deleteAction,\n" +
  "                            holder.pinAction,\n",
  "Stage16B swipe reset refs");
        source = replaceSection(source, info, value);

        info = section(source,
  "    function makeResultCard(row, colors) {",
  "\n    function ",
  "Stage16B result card holder store");
        value = info.text;
        value = replaceOnceStrict(value,
  "            metrics: metrics\n" +
  "        };\n",
  "            metrics: metrics,\n" +
  "            sourcePackage: String(row.source_package || \"\")\n" +
  "        };\n",
  "Stage16B source package holder field");
        value = replaceOnceStrict(value,
  "        resultCardViews.push(card);\n" +
  "        state.resultCardCount += 1;\n",
  "        resultCardViews.push(card);\n" +
  "        resultCardHolders.push(holder);\n" +
  "        scrollPerformanceState.holderNewBuildCount += 1;\n" +
  "        state.resultCardCount += 1;\n",
  "Stage16B holder push");
        source = replaceSection(source, info, value);

        info = section(source,
  "    function removeVirtualEntryAt(index) {",
  "\n    function ",
  "Stage16B keyed remove");
        value = info.text;
        value = replaceOnceStrict(value,
  "        resultCardViews.splice(index, 1);\n" +
  "        resultActionViews.splice(index, 1);\n",
  "        resultCardViews.splice(index, 1);\n" +
  "        resultCardHolders.splice(index, 1);\n" +
  "        resultActionViews.splice(index, 1);\n",
  "Stage16B keyed holder remove");
        source = replaceSection(source, info, value);

        info = section(source,
  "    function insertVirtualEntryAt(index, row, colors, signature) {",
  "\n    function ",
  "Stage16B keyed insert");
        value = info.text;
        value = replaceOnceStrict(value,
  "        var actionRef;\n",
  "        var actionRef;\n" +
  "        var holderRef;\n",
  "Stage16B keyed insert holder var");
        value = replaceOnceStrict(value,
  "        cardRef = resultCardViews.pop();\n" +
  "        actionRef = resultActionViews.pop();\n",
  "        cardRef = resultCardViews.pop();\n" +
  "        holderRef = resultCardHolders.pop();\n" +
  "        actionRef = resultActionViews.pop();\n",
  "Stage16B keyed insert holder pop");
        value = replaceOnceStrict(value,
  "        resultCardViews.splice(index, 0, cardRef);\n" +
  "        resultActionViews.splice(index, 0, actionRef);\n",
  "        resultCardViews.splice(index, 0, cardRef);\n" +
  "        resultCardHolders.splice(index, 0, holderRef);\n" +
  "        resultActionViews.splice(index, 0, actionRef);\n",
  "Stage16B keyed insert holder splice");
        source = replaceSection(source, info, value);

        info = section(source,
  "    function moveVirtualEntry(fromIndex, toIndex) {",
  "\n    function ",
  "Stage16B keyed move");
        value = info.text;
        value = replaceOnceStrict(value,
  "        var cardRef = resultCardViews[fromIndex];\n" +
  "        var actionRef = resultActionViews[fromIndex];\n",
  "        var cardRef = resultCardViews[fromIndex];\n" +
  "        var holderRef = resultCardHolders[fromIndex];\n" +
  "        var actionRef = resultActionViews[fromIndex];\n",
  "Stage16B keyed move holder ref");
        value = replaceOnceStrict(value,
  "        resultCardViews.splice(fromIndex, 1);\n" +
  "        resultActionViews.splice(fromIndex, 1);\n",
  "        resultCardViews.splice(fromIndex, 1);\n" +
  "        resultCardHolders.splice(fromIndex, 1);\n" +
  "        resultActionViews.splice(fromIndex, 1);\n",
  "Stage16B keyed move holder remove");
        value = replaceOnceStrict(value,
  "        resultCardViews.splice(toIndex, 0, cardRef);\n" +
  "        resultActionViews.splice(toIndex, 0, actionRef);\n",
  "        resultCardViews.splice(toIndex, 0, cardRef);\n" +
  "        resultCardHolders.splice(toIndex, 0, holderRef);\n" +
  "        resultActionViews.splice(toIndex, 0, actionRef);\n",
  "Stage16B keyed move holder insert");
        source = replaceSection(source, info, value);

        info = section(source,
  "    function keyedReconcileVirtualWindow(range, colors) {",
  "\n    function ",
  "Stage16B keyed alignment");
        value = info.text;
        value = replaceOnceStrict(value,
  "      resultCardViews.length !== childCount ||\n" +
  "      resultActionViews.length !== childCount) {\n",
  "      resultCardViews.length !== childCount ||\n" +
  "      resultCardHolders.length !== childCount ||\n" +
  "      resultActionViews.length !== childCount) {\n",
  "Stage16B keyed holder alignment");
        source = replaceSection(source, info, value);

        info = section(source,
  "    function rebuildVirtualWindow(origin, force, preferredIndex) {",
  "\n    function scheduleVirtualUpdate(",
  "Stage16B overlap recycle");
        value = info.text;
        value = replaceOnceStrict(value,
  "        var actionRef;\n" +
  "        var recycledCount;\n",
  "        var actionRef;\n" +
  "        var holderRef;\n" +
  "        var recyclePool = [];\n" +
  "        var recycleEnabled = String(origin || \"\") === \"result_scroll\" ||\n" +
  "            String(origin || \"\") === \"hydration_apply\";\n" +
  "        var recycledCount;\n",
  "Stage16B recycle vars");
        value = replaceOnceStrict(value,
  "            resultCardViews.length === oldCount &&\n" +
  "            resultActionViews.length === oldCount;\n",
  "            resultCardViews.length === oldCount &&\n" +
  "            resultCardHolders.length === oldCount &&\n" +
  "            resultActionViews.length === oldCount;\n",
  "Stage16B overlap holder alignment");
        value = replaceOnceStrict(value,
  "                resultCardViews.shift();\n" +
  "                resultActionViews.shift();\n",
  "                resultCardViews.shift();\n" +
  "                holderRef = resultCardHolders.shift();\n" +
  "                resultActionViews.shift();\n" +
  "                if (recycleEnabled && holderRef !== null &&\n" +
  "                        holderRef !== undefined) {\n" +
  "                    recyclePool.push(holderRef);\n" +
  "                    scrollPerformanceState.holderRecycleReleaseCount += 1;\n" +
  "                }\n",
  "Stage16B recycle top release");
        value = replaceOnceStrict(value,
  "                resultCardViews.pop();\n" +
  "                resultActionViews.pop();\n",
  "                resultCardViews.pop();\n" +
  "                holderRef = resultCardHolders.pop();\n" +
  "                resultActionViews.pop();\n" +
  "                if (recycleEnabled && holderRef !== null &&\n" +
  "                        holderRef !== undefined) {\n" +
  "                    recyclePool.push(holderRef);\n" +
  "                    scrollPerformanceState.holderRecycleReleaseCount += 1;\n" +
  "                }\n",
  "Stage16B recycle bottom release");

        value = replaceOnceStrict(value,
  "                    wrapper = makeResultCard(previewRows[index], colors);\n" +
  "                    cardRef = resultCardViews.pop();\n" +
  "                    actionRef = resultActionViews.pop();\n" +
  "                    virtualCardHost.addView(wrapper, 0, params);\n" +
  "                    resultCardViews.unshift(cardRef);\n" +
  "                    resultActionViews.unshift(actionRef);\n",
  "                    holderRef = null;\n" +
  "                    if (recycleEnabled && recyclePool.length > 0) {\n" +
  "                        holderRef = recyclePool.pop();\n" +
  "                        if (rebindResultCardHolder(holderRef,\n" +
  "                                previewRows[index], colors)) {\n" +
  "                            wrapper = holderRef.wrapper;\n" +
  "                            cardRef = holderRef.card;\n" +
  "                            actionRef = cardHolderActionRefs(holderRef);\n" +
  "                            scrollPerformanceState.holderRecycleReuseCount += 1;\n" +
  "                        } else {\n" +
  "                            scrollPerformanceState.holderRecycleDiscardCount += 1;\n" +
  "                            holderRef = null;\n" +
  "                        }\n" +
  "                    }\n" +
  "                    if (holderRef === null) {\n" +
  "                        wrapper = makeResultCard(previewRows[index], colors);\n" +
  "                        cardRef = resultCardViews.pop();\n" +
  "                        holderRef = resultCardHolders.pop();\n" +
  "                        actionRef = resultActionViews.pop();\n" +
  "                        if (recycleEnabled) {\n" +
  "                            scrollPerformanceState.holderRecycleMissCount += 1;\n" +
  "                        }\n" +
  "                    }\n" +
  "                    virtualCardHost.addView(wrapper, 0, params);\n" +
  "                    resultCardViews.unshift(cardRef);\n" +
  "                    resultCardHolders.unshift(holderRef);\n" +
  "                    resultActionViews.unshift(actionRef);\n",
  "Stage16B prepend recycle");

        value = replaceOnceStrict(value,
  "                    virtualCardHost.addView(makeResultCard(\n" +
  "                        previewRows[index], colors), params);\n" +
  "                    virtualRenderedItemIds.push(\n",
  "                    holderRef = null;\n" +
  "                    if (recycleEnabled && recyclePool.length > 0) {\n" +
  "                        holderRef = recyclePool.pop();\n" +
  "                        if (rebindResultCardHolder(holderRef,\n" +
  "                                previewRows[index], colors)) {\n" +
  "                            wrapper = holderRef.wrapper;\n" +
  "                            cardRef = holderRef.card;\n" +
  "                            actionRef = cardHolderActionRefs(holderRef);\n" +
  "                            scrollPerformanceState.holderRecycleReuseCount += 1;\n" +
  "                        } else {\n" +
  "                            scrollPerformanceState.holderRecycleDiscardCount += 1;\n" +
  "                            holderRef = null;\n" +
  "                        }\n" +
  "                    }\n" +
  "                    if (holderRef === null) {\n" +
  "                        wrapper = makeResultCard(previewRows[index], colors);\n" +
  "                        cardRef = resultCardViews.pop();\n" +
  "                        holderRef = resultCardHolders.pop();\n" +
  "                        actionRef = resultActionViews.pop();\n" +
  "                        if (recycleEnabled) {\n" +
  "                            scrollPerformanceState.holderRecycleMissCount += 1;\n" +
  "                        }\n" +
  "                    }\n" +
  "                    virtualCardHost.addView(wrapper, params);\n" +
  "                    resultCardViews.push(cardRef);\n" +
  "                    resultCardHolders.push(holderRef);\n" +
  "                    resultActionViews.push(actionRef);\n" +
  "                    virtualRenderedItemIds.push(\n",
  "Stage16B append recycle");

        value = replaceOnceStrict(value,
  "            state.resultCardCount = Number(\n" +
  "                virtualCardHost.getChildCount());\n" +
  "            overlapElapsed = Math.max(0,\n",
  "            if (recycleEnabled && recyclePool.length > 0) {\n" +
  "                scrollPerformanceState.holderRecycleDiscardCount +=\n" +
  "                    recyclePool.length;\n" +
  "                recyclePool = [];\n" +
  "            }\n" +
  "            state.resultCardCount = Number(\n" +
  "                virtualCardHost.getChildCount());\n" +
  "            overlapElapsed = Math.max(0,\n",
  "Stage16B recycle discard remainder");
        source = replaceSection(source, info, value);

        if (source.indexOf("resultCardHolders.length === oldCount") < 0 ||
      source.indexOf("function rebindResultCardHolder(holder, row, colors)") < 0 ||
      source.indexOf("holderRecycleReuseCount") < 0 ||
      source.indexOf("String(origin || \"\") === \"result_scroll\"") < 0 ||
      source.indexOf("String(origin || \"\") === \"hydration_apply\"") < 0) {
  throw new Error("Stage16B recycle wiring incomplete");
        }
        if (source.indexOf("String(origin || \"\") === \"ajax_append\"") >= 0) {
  throw new Error("Stage16B must not recycle ajax_append");
        }
        return source;
    }

    try {
        eval(transformRecycleSource(
            transformCardHolderSource(
                transformSource(decodeSource(loadPackedSource())))));
    } catch (error) {
        throw new Error("ch_11_filter.js Stage 16B loader failed: " +
            String(error));
    }
}((function () { return this; }())));
