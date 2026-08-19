/*
 * ClipHub 分类器兼容模块。
 *
 * 自动内容分类已取消。该模块只保留旧脚本可调用的纯文本分类接口，
 * 不修改 UI、数据库或其他模块，也不参与 App 生命周期。
 */
(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});

    ClipHub.Classifier = {
        MODULE_NAME: "ch_05_classifier",
        MODULE_VERSION: 3,
        classify: function (value) {
            var text = String(value === null || value === undefined ? "" : value);
            return {
                type: "text",
                confidence: 100,
                normalizedContent: text
            };
        },
        getState: function () {
            return {
                compatibilityOnly: true,
                automaticClassification: false
            };
        }
    };
}((function () { return this; }())));
