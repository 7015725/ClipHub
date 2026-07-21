(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var File = Packages.java.io.File;
    var path = null;
    var database = null;

    ClipHub.Database = {
        MODULE_NAME: "ch_03_database",
        MODULE_VERSION: 1,
        init: function (context) {
            var dir = ClipHub.Base.ensureDir(
                ClipHub.Base.joinPath(context.runtimeDir, "data")
            );
            path = String(new File(dir, "cliphub.db").getAbsolutePath());
            return true;
        },
        getPath: function () { return path; },
        isOpen: function () {
            return database !== null && database.isOpen();
        },
        shutdown: function () {
            if (database !== null) {
                try { database.close(); } catch (ignored) {}
            }
            database = null;
            return true;
        }
    };
}((function () { return this; }())));
