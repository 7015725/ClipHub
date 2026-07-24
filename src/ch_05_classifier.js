/*
 * ClipHub 入口兼容占位模块。
 *
 * ENTRY_VERSION 5 的 ClipHub.js 使用固定的 15 文件模块表，并要求
 * module-manifest.json 中保留 ch_05_classifier.js。内容类型分类与筛选
 * 功能已经退休；此文件不导出 API、不创建状态，也不参与 App 初始化。
 */
(function () {
    return true;
}());
