(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var itemIds = [];
    ClipHub.List = {
        MODULE_NAME: "ch_09_list",
        MODULE_VERSION: 1,
        init: function () { itemIds = []; return true; },
        setItems: function (items) {
            var index;
            itemIds = [];
            for (index = 0; index < items.length; index += 1) {
                itemIds.push(items[index].id);
            }
            return itemIds.length;
        },
        clear: function () { itemIds = []; },
        shutdown: function () { itemIds = []; return true; }
    };
}((function () { return this; }())));
