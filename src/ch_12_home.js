// @version 1.0.0
// ClipHub - 首页 / 列表页视觉基线
(function (CH) {
    "use strict";

    var base = CH.base;
    var theme = CH.theme;
    var components = CH.components;
    var C = theme.colors;
    var D = theme.dimensions;

    var demoItems = [
        {
            packageName: "com.android.chrome",
            fallback: "C",
            fallbackColor: C.info,
            content: "https://developer.android.com/",
            time: "10:29",
            tags: [
                { text: "网址", fill: C.chipBlue, color: C.chipBlueText },
                { text: "开发资源", fill: C.chipGreen, color: C.chipGreenText }
            ],
            selected: false,
            favorite: false
        },
        {
            packageName: "com.tencent.mm",
            fallback: "微",
            fallbackColor: C.success,
            content: "会议在明天下午三点，地点是B栋会议室，\n请准时参加。",
            time: "10:25",
            tags: [
                { text: "文本", fill: C.chipBlue, color: C.chipBlueText },
                { text: "会议", fill: C.chipOrange, color: C.chipOrangeText }
            ],
            selected: false,
            favorite: false
        },
        {
            packageName: "com.android.dialer",
            fallback: "☎",
            fallbackColor: C.success,
            content: "+86 138 0013 8000",
            time: "10:20",
            tags: [
                { text: "电话号码", fill: C.chipBlue, color: C.chipBlueText },
                { text: "联系人", fill: C.chipGreen, color: C.chipGreenText }
            ],
            selected: true,
            favorite: true
        },
        {
            packageName: "com.google.android.gm",
            fallback: "M",
            fallbackColor: C.danger,
            content: "design.team@example.com",
            time: "10:18",
            tags: [
                { text: "邮箱", fill: C.chipBlue, color: C.chipBlueText },
                { text: "工作", fill: C.chipPurple, color: C.chipPurpleText }
            ],
            selected: false,
            favorite: false
        },
        {
            packageName: "org.telegram.messenger",
            fallback: "T",
            fallbackColor: C.info,
            content: "@AndroidDev 频道分享了 Android 14\n新特性，值得关注。",
            time: "10:15",
            tags: [
                { text: "文本", fill: C.chipBlue, color: C.chipBlueText },
                { text: "资讯", fill: C.chipOrange, color: C.chipOrangeText }
            ],
            selected: false,
            favorite: false
        },
        {
            packageName: "com.termux",
            fallback: "›_",
            fallbackColor: C.info,
            content: "const greet = (name) => {\n  return `Hello, ${name}!`;\n};",
            time: "10:10",
            tags: [
                { text: "代码", fill: C.chipBlue, color: C.chipBlueText },
                { text: "代码片段", fill: C.chipGreen, color: C.chipGreenText }
            ],
            code: true,
            selected: false,
            favorite: false
        },
        {
            packageName: "com.google.android.apps.docs.editors.docs",
            fallback: "D",
            fallbackColor: C.info,
            content: "Android 14 引入了对预测性返回动画的支持，\n提升了用户体验和应用的流畅度。",
            time: "10:05",
            tags: [
                { text: "文本", fill: C.chipBlue, color: C.chipBlueText },
                { text: "笔记", fill: C.chipOrange, color: C.chipOrangeText }
            ],
            selected: false,
            favorite: false
        }
    ];

    function makeHeader() {
        var row = new android.widget.LinearLayout(base.getContext());
        row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        row.setGravity(android.view.Gravity.CENTER_VERTICAL);
        row.setPadding(base.dp(2), 0, 0, 0);
        row.setLayoutParams(new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, base.dp(D.headerHeight)));

        var logoWrap = new android.widget.FrameLayout(base.getContext());
        logoWrap.setBackground(theme.rounded(C.primaryFaint, 11, C.border, 1));
        var logoLp = new android.widget.LinearLayout.LayoutParams(base.dp(38), base.dp(38));
        row.addView(logoWrap, logoLp);
        var logo = components.iconView("clipboard", C.textPrimary, 23, false);
        var logoIconLp = new android.widget.FrameLayout.LayoutParams(base.dp(24), base.dp(24));
        logoIconLp.gravity = android.view.Gravity.CENTER;
        logoWrap.addView(logo, logoIconLp);

        var title = components.text("全局剪切板", theme.text.titleSp, C.textPrimary, true);
        var titleLp = new android.widget.LinearLayout.LayoutParams(0,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        titleLp.leftMargin = base.dp(10);
        row.addView(title, titleLp);

        var pin = components.iconButton("pin", function () {
            components.toast("窗口置顶状态将在数据阶段接入");
        }, {
            sizeDp: 38,
            iconSizeDp: 21,
            fillColor: C.transparent,
            iconColor: C.textPrimary
        });
        components.setContentDescription(pin, "置顶窗口");
        row.addView(pin);

        var settings = components.iconButton("settings", function () {
            CH.router.open("settings", {});
        }, {
            sizeDp: 38,
            iconSizeDp: 21,
            fillColor: C.transparent,
            iconColor: C.textPrimary
        });
        components.setContentDescription(settings, "设置");
        row.addView(settings);
        return row;
    }

    function makeSearchRow() {
        var row = new android.widget.LinearLayout(base.getContext());
        row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        row.setGravity(android.view.Gravity.CENTER_VERTICAL);
        var rowLp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, base.dp(D.searchHeight));
        rowLp.bottomMargin = base.dp(8);
        row.setLayoutParams(rowLp);

        var search = components.searchField("搜索剪切板内容", function () {
            CH.router.open("filter", {});
        });
        row.addView(search, new android.widget.LinearLayout.LayoutParams(0,
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, 1));

        var filter = new android.widget.LinearLayout(base.getContext());
        filter.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        filter.setGravity(android.view.Gravity.CENTER);
        filter.setPadding(base.dp(10), 0, base.dp(11), 0);
        filter.setBackground(theme.ripple(
            theme.rounded(C.primarySoft, D.buttonRadius, null, 0),
            C.surfacePressed
        ));
        filter.setClickable(true);
        filter.setFocusable(true);
        filter.setOnClickListener(base.makeClickListener(function () {
            CH.router.open("filter", {});
        }));
        var filterLp = new android.widget.LinearLayout.LayoutParams(base.dp(82),
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT);
        filterLp.leftMargin = base.dp(8);
        row.addView(filter, filterLp);
        var filterIcon = components.iconView("filter", C.textPrimary, 19, false);
        filter.addView(filterIcon, new android.widget.LinearLayout.LayoutParams(base.dp(21), base.dp(21)));
        var filterText = components.text("筛选", 13, C.textPrimary, false);
        var filterTextLp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        filterTextLp.leftMargin = base.dp(6);
        filter.addView(filterText, filterTextLp);

        var add = components.iconButton("plus", function () {
            CH.router.open("editor", { mode: "add" });
        }, {
            sizeDp: D.searchHeight,
            iconSizeDp: 23,
            fillColor: C.primarySoft,
            iconColor: C.textPrimary,
            radiusDp: D.searchHeight / 2
        });
        var addLp = new android.widget.LinearLayout.LayoutParams(base.dp(D.searchHeight), base.dp(D.searchHeight));
        addLp.leftMargin = base.dp(8);
        add.setLayoutParams(addLp);
        components.setContentDescription(add, "新增内容");
        row.addView(add);
        return row;
    }

    function makeMetaRow() {
        var row = new android.widget.LinearLayout(base.getContext());
        row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        row.setGravity(android.view.Gravity.CENTER_VERTICAL);
        row.setPadding(base.dp(4), 0, base.dp(2), 0);
        var rowLp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, base.dp(30));
        row.setLayoutParams(rowLp);

        var count = components.text("共 23 条", 11, C.textSecondary, false);
        row.addView(count);

        var hint = components.text("⠿  长按并拖动可排序", 11, C.textSecondary, false);
        hint.setGravity(android.view.Gravity.CENTER);
        row.addView(hint, new android.widget.LinearLayout.LayoutParams(0,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        var manage = components.text("管理", 12, C.primary, true);
        manage.setPadding(base.dp(10), base.dp(4), 0, base.dp(4));
        manage.setClickable(true);
        manage.setOnClickListener(base.makeClickListener(function () {
            components.toast("已进入演示多选状态");
        }));
        row.addView(manage);
        return row;
    }

    function makeSelectionIndicator(selected) {
        var wrap = new android.widget.FrameLayout(base.getContext());
        var size = selected ? 26 : 0;
        wrap.setLayoutParams(new android.widget.LinearLayout.LayoutParams(base.dp(size), base.dp(38)));
        if (!selected) return wrap;
        wrap.setBackground(theme.rounded(C.primary, 13, null, 0));
        var check = components.iconView("check", C.white, 15, false);
        var checkLp = new android.widget.FrameLayout.LayoutParams(base.dp(15), base.dp(15));
        checkLp.gravity = android.view.Gravity.CENTER;
        wrap.addView(check, checkLp);
        return wrap;
    }

    function makeTagsRow(tags) {
        var row = new android.widget.LinearLayout(base.getContext());
        row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        row.setGravity(android.view.Gravity.CENTER_VERTICAL);
        var i = 0;
        for (i = 0; i < tags.length; i++) {
            var tag = tags[i];
            var chip = components.chip(tag.text, tag.fill, tag.color, {
                heightDp: 21,
                paddingH: 7,
                textSp: 9.5
            });
            var lp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, base.dp(21));
            if (i > 0) lp.leftMargin = base.dp(5);
            row.addView(chip, lp);
        }
        return row;
    }

    function makeCard(item, index) {
        var card = new android.widget.LinearLayout(base.getContext());
        card.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        card.setGravity(android.view.Gravity.CENTER_VERTICAL);
        card.setPadding(base.dp(10), base.dp(9), base.dp(8), base.dp(9));
        card.setBackground(components.cardBackground(!!item.selected));
        card.setClickable(true);
        card.setFocusable(true);
        theme.applyElevation(card, item.selected ? 2 : 1);
        card.setOnClickListener(base.makeClickListener(function () {
            CH.router.open("detail", { index: index, item: item });
        }));
        card.setOnLongClickListener(base.makeLongClickListener(function () {
            components.toast("长按排序手势已预留");
            return true;
        }));

        var selection = makeSelectionIndicator(!!item.selected);
        card.addView(selection);
        if (item.selected) {
            var selectionLp = selection.getLayoutParams();
            selectionLp.rightMargin = base.dp(8);
            selection.setLayoutParams(selectionLp);
        }

        var appIcon = components.appIcon(item.packageName, item.fallback, item.fallbackColor, 38);
        card.addView(appIcon);

        var center = new android.widget.LinearLayout(base.getContext());
        center.setOrientation(android.widget.LinearLayout.VERTICAL);
        center.setGravity(android.view.Gravity.CENTER_VERTICAL);
        var centerLp = new android.widget.LinearLayout.LayoutParams(0,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        centerLp.leftMargin = base.dp(10);
        centerLp.rightMargin = base.dp(6);
        card.addView(center, centerLp);

        var content = components.text(item.content, item.code ? 12 : 13.5, C.textPrimary, false);
        content.setMaxLines(2);
        content.setEllipsize(android.text.TextUtils.TruncateAt.END);
        content.setGravity(android.view.Gravity.START);
        try {
            content.setLineSpacing(base.dp(1), 1.0);
        } catch (eLineSpacing) {}
        if (item.code) {
            try {
                content.setTypeface(android.graphics.Typeface.MONOSPACE);
            } catch (eMono) {}
        }
        center.addView(content, new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT));

        var tags = makeTagsRow(item.tags || []);
        var tagsLp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, base.dp(23));
        tagsLp.topMargin = base.dp(5);
        center.addView(tags, tagsLp);

        var right = new android.widget.LinearLayout(base.getContext());
        right.setOrientation(android.widget.LinearLayout.VERTICAL);
        right.setGravity(android.view.Gravity.RIGHT | android.view.Gravity.CENTER_VERTICAL);
        card.addView(right, new android.widget.LinearLayout.LayoutParams(base.dp(50),
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT));

        var time = components.text(item.time, 10.5, C.textSecondary, false);
        time.setGravity(android.view.Gravity.RIGHT);
        right.addView(time, new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        var actions = new android.widget.LinearLayout(base.getContext());
        actions.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        actions.setGravity(android.view.Gravity.RIGHT | android.view.Gravity.CENTER_VERTICAL);
        right.addView(actions, new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, base.dp(30)));

        var star = components.iconView("star", item.favorite ? C.primary : C.textTertiary, 20, !!item.favorite);
        actions.addView(star, new android.widget.LinearLayout.LayoutParams(base.dp(24), base.dp(24)));
        var more = components.iconView("more", C.textPrimary, 20, false);
        var moreLp = new android.widget.LinearLayout.LayoutParams(base.dp(22), base.dp(22));
        moreLp.leftMargin = base.dp(2);
        actions.addView(more, moreLp);
        return card;
    }

    function makeList() {
        var scroll = new android.widget.ScrollView(base.getContext());
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        scroll.setPadding(0, base.dp(2), 0, base.dp(4));
        try {
            scroll.setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);
            scroll.setVerticalScrollBarEnabled(false);
        } catch (eScrollMode) {}

        var list = new android.widget.LinearLayout(base.getContext());
        list.setOrientation(android.widget.LinearLayout.VERTICAL);
        scroll.addView(list, new android.widget.ScrollView.LayoutParams(
            android.widget.ScrollView.LayoutParams.MATCH_PARENT,
            android.widget.ScrollView.LayoutParams.WRAP_CONTENT));

        var i = 0;
        for (i = 0; i < demoItems.length; i++) {
            var card = makeCard(demoItems[i], i);
            var cardLp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
            cardLp.bottomMargin = base.dp(D.cardGap);
            list.addView(card, cardLp);
        }
        return scroll;
    }

    function makeBottomBar() {
        var bar = new android.widget.LinearLayout(base.getContext());
        bar.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        bar.setGravity(android.view.Gravity.CENTER);
        bar.setPadding(base.dp(4), base.dp(2), base.dp(4), base.dp(2));
        bar.setBackground(theme.rounded(C.primaryFaint, 18, null, 0));
        theme.applyElevation(bar, 4);
        var barLp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, base.dp(D.bottomBarHeight));
        barLp.topMargin = base.dp(2);
        bar.setLayoutParams(barLp);

        var actions = [
            { type: "pin", label: "置顶", route: null },
            { type: "edit", label: "编辑", route: "editor" },
            { type: "plus", label: "新增", route: "editor", selected: true },
            { type: "delete", label: "删除", route: null },
            { type: "translate", label: "翻译", route: "detail" }
        ];
        var i = 0;
        for (i = 0; i < actions.length; i++) {
            (function (action) {
                var button = components.bottomAction(action.type, action.label, function () {
                    if (action.route === "editor") {
                        CH.router.open("editor", { mode: action.type === "plus" ? "add" : "edit" });
                    } else if (action.route === "detail") {
                        CH.router.open("detail", { item: demoItems[2] });
                    } else if (action.type === "delete") {
                        components.toast("删除与撤销将在数据阶段接入");
                    } else {
                        components.toast("已对当前选中内容执行演示操作");
                    }
                }, !!action.selected);
                bar.addView(button, new android.widget.LinearLayout.LayoutParams(0,
                    android.widget.LinearLayout.LayoutParams.MATCH_PARENT, 1));
            }(actions[i]));
        }
        return bar;
    }

    function buildHomePage() {
        var root = new android.widget.LinearLayout(base.getContext());
        root.setOrientation(android.widget.LinearLayout.VERTICAL);
        root.setBackgroundColor(C.transparent);
        root.addView(makeHeader());
        root.addView(makeSearchRow());
        root.addView(makeMetaRow());
        var list = makeList();
        root.addView(list, new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        root.addView(makeBottomBar());
        return root;
    }

    function buildPlaceholderPage(params, titleText, bodyText, iconType) {
        var root = new android.widget.LinearLayout(base.getContext());
        root.setOrientation(android.widget.LinearLayout.VERTICAL);
        root.setBackgroundColor(C.transparent);

        var header = new android.widget.LinearLayout(base.getContext());
        header.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        header.setGravity(android.view.Gravity.CENTER_VERTICAL);
        header.setLayoutParams(new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, base.dp(D.headerHeight)));
        var back = components.iconButton("back", function () {
            CH.router.back();
        }, {
            sizeDp: 38,
            iconSizeDp: 21,
            fillColor: C.transparent,
            iconColor: C.textPrimary
        });
        header.addView(back);
        var title = components.text(titleText, 19, C.textPrimary, true);
        var titleLp = new android.widget.LinearLayout.LayoutParams(0,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        titleLp.leftMargin = base.dp(6);
        header.addView(title, titleLp);
        var close = components.iconButton("close", function () {
            CH.window.close("placeholder_close");
        }, {
            sizeDp: 38,
            iconSizeDp: 18,
            fillColor: C.primarySoft,
            iconColor: C.textSecondary
        });
        header.addView(close);
        root.addView(header);

        var body = new android.widget.LinearLayout(base.getContext());
        body.setOrientation(android.widget.LinearLayout.VERTICAL);
        body.setGravity(android.view.Gravity.CENTER);
        body.setPadding(base.dp(28), base.dp(20), base.dp(28), base.dp(20));
        body.setBackground(theme.rounded(C.surface, 18, C.border, 1));
        var bodyLp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
        bodyLp.topMargin = base.dp(8);
        bodyLp.bottomMargin = base.dp(12);
        root.addView(body, bodyLp);

        var iconWrap = new android.widget.FrameLayout(base.getContext());
        iconWrap.setBackground(theme.rounded(C.primarySoft, 30, null, 0));
        body.addView(iconWrap, new android.widget.LinearLayout.LayoutParams(base.dp(60), base.dp(60)));
        var icon = components.iconView(iconType || "clipboard", C.primary, 30, false);
        var iconLp = new android.widget.FrameLayout.LayoutParams(base.dp(31), base.dp(31));
        iconLp.gravity = android.view.Gravity.CENTER;
        iconWrap.addView(icon, iconLp);

        var bodyTitle = components.text(titleText + "视觉骨架", 17, C.textPrimary, true);
        bodyTitle.setGravity(android.view.Gravity.CENTER);
        var bodyTitleLp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        bodyTitleLp.topMargin = base.dp(18);
        body.addView(bodyTitle, bodyTitleLp);

        var bodyDescription = components.text(bodyText, 13, C.textSecondary, false);
        bodyDescription.setGravity(android.view.Gravity.CENTER);
        bodyDescription.setTextAlignment(android.view.View.TEXT_ALIGNMENT_CENTER);
        try {
            bodyDescription.setLineSpacing(base.dp(4), 1.0);
        } catch (eBodyLine) {}
        var descriptionLp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT);
        descriptionLp.topMargin = base.dp(10);
        body.addView(bodyDescription, descriptionLp);

        var stage = components.chip("阶段 1 · 页面路由已接通", C.primarySoft, C.primary, {
            heightDp: 30,
            paddingH: 12,
            textSp: 11,
            bold: true,
            radiusDp: 15
        });
        var stageLp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, base.dp(30));
        stageLp.topMargin = base.dp(18);
        body.addView(stage, stageLp);
        return root;
    }

    CH.router.register("home", function () {
        return buildHomePage();
    });

    CH.router.register("filter", function (params) {
        return buildPlaceholderPage(params, "搜索 / 筛选",
            "下一阶段将按参考图实现实时搜索、关键词高亮、来源应用多选、内容类型多选、标签多选与排序抽屉。",
            "filter");
    });

    CH.router.register("editor", function (params) {
        return buildPlaceholderPage(params, params && params.mode === "edit" ? "编辑剪切板" : "新增剪切板",
            "页面容器、返回栈、关闭路径和输入法窗口参数已经建立，下一阶段接入完整编辑表单。",
            "edit");
    });

    CH.router.register("detail", function (params) {
        return buildPlaceholderPage(params, "详情 / 识别 / 翻译",
            "详情页将在后续阶段加入原文、URL、电话、邮箱、代码片段识别、一键翻译与快捷操作。",
            "translate");
    });

    CH.router.register("settings", function (params) {
        return buildPlaceholderPage(params, "设置",
            "当前使用参考图固定紫色主题。动态颜色、窗口尺寸、位置持久化和数据设置将在稳定阶段接入。",
            "settings");
    });

    CH.router.register("tags", function (params) {
        return buildPlaceholderPage(params, "标签 / 分类管理",
            "标签统计、系统标签保护、自定义颜色、拖动排序和批量归类将在标签阶段实现。",
            "tag");
    });

    CH.home = {
        demoItems: demoItems,
        build: buildHomePage
    };
}(CH));
