/* ClipHub Stage 16B.2 Holder rebind fix and alignment diagnostics ES5 loader. */
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
    var Base64 = Packages.android.util.Base64;

    var BASE_URL =
        "https://raw.githubusercontent.com/7015725/ClipHub/" +
        "338a811e538ab526b59eed05102d4f4b66f19953/" +
        "src/ch_11_filter.js";
    var BASE_BLOB_SHA1 = "160cbf0aa482868042c89dad33eae990ccd93488";
    var CACHE_NAME = "ch_11_filter_stage16b_baseline_loader.js";
    var PATCH_B64 =
        "ICAgIGZ1bmN0aW9uIHRyYW5zZm9ybVJlY3ljbGVGaXhTb3VyY2Uoc291cmNlKSB7CiAgICAgICAgdmFyIGluZm87CiAgICAgICAgdmFyIHZhbHVlOwoKICAg" +
        "ICAgICBzb3VyY2UgPSByZXBsYWNlT25jZVN0cmljdChzb3VyY2UsCiAgICAgICAgICAgICJNT0RVTEVfVkVSU0lPTjogNTkiLCAiTU9EVUxFX1ZFUlNJT046" +
        "IDYwIiwKICAgICAgICAgICAgIlN0YWdlMTZCMSBtb2R1bGUgdmVyc2lvbiIpOwoKICAgICAgICBzb3VyY2UgPSByZXBsYWNlT25jZVN0cmljdChzb3VyY2Us" +
        "CiAgICAgICAgICAgICIgICAgICAgIGhvbGRlck5ld0J1aWxkQ291bnQ6IDBcbiIsCiAgICAgICAgICAgICIgICAgICAgIGhvbGRlck5ld0J1aWxkQ291bnQ6" +
        "IDAsXG4iICsKICAgICAgICAgICAgIiAgICAgICAgaG9sZGVyUmViaW5kQXR0ZW1wdENvdW50OiAwLFxuIiArCiAgICAgICAgICAgICIgICAgICAgIGhvbGRl" +
        "clJlYmluZEVsaWdpYmxlQ291bnQ6IDAsXG4iICsKICAgICAgICAgICAgIiAgICAgICAgaG9sZGVyUmViaW5kSW5lbGlnaWJsZUNvdW50OiAwLFxuIiArCiAg" +
        "ICAgICAgICAgICIgICAgICAgIGhvbGRlclJlYmluZEZhaWx1cmVDb3VudDogMCxcbiIgKwogICAgICAgICAgICAiICAgICAgICBob2xkZXJSZWJpbmRMYXN0" +
        "UmVqZWN0UmVhc29uOiBcIlwiLFxuIiArCiAgICAgICAgICAgICIgICAgICAgIGhvbGRlclJlYmluZExhc3RGYWlsdXJlU3RhZ2U6IFwiXCIsXG4iICsKICAg" +
        "ICAgICAgICAgIiAgICAgICAgaG9sZGVyUmViaW5kTGFzdEVycm9yOiBcIlwiLFxuIiArCiAgICAgICAgICAgICIgICAgICAgIGhvbGRlclJlYmluZFJlamVj" +
        "dFJlYXNvbnM6IHt9LFxuIiArCiAgICAgICAgICAgICIgICAgICAgIGhvbGRlclJlYmluZEZhaWx1cmVTdGFnZXM6IHt9XG4iLAogICAgICAgICAgICAiU3Rh" +
        "Z2UxNkIxIG1ldHJpY3MiKTsKCiAgICAgICAgc291cmNlID0gcmVwbGFjZU9uY2VTdHJpY3Qoc291cmNlLAogICAgICAgICAgICAiICAgICAgICBzY3JvbGxQ" +
        "ZXJmb3JtYW5jZVN0YXRlLmhvbGRlck5ld0J1aWxkQ291bnQgPSAwO1xuIiwKICAgICAgICAgICAgIiAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5o" +
        "b2xkZXJOZXdCdWlsZENvdW50ID0gMDtcbiIgKwogICAgICAgICAgICAiICAgICAgICBzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJlYmluZEF0dGVt" +
        "cHRDb3VudCA9IDA7XG4iICsKICAgICAgICAgICAgIiAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJpbmRFbGlnaWJsZUNvdW50ID0g" +
        "MDtcbiIgKwogICAgICAgICAgICAiICAgICAgICBzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJlYmluZEluZWxpZ2libGVDb3VudCA9IDA7XG4iICsK" +
        "ICAgICAgICAgICAgIiAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJpbmRGYWlsdXJlQ291bnQgPSAwO1xuIiArCiAgICAgICAgICAg" +
        "ICIgICAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuaG9sZGVyUmViaW5kTGFzdFJlamVjdFJlYXNvbiA9IFwiXCI7XG4iICsKICAgICAgICAgICAgIiAg" +
        "ICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJpbmRMYXN0RmFpbHVyZVN0YWdlID0gXCJcIjtcbiIgKwogICAgICAgICAgICAiICAgICAg" +
        "ICBzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJlYmluZExhc3RFcnJvciA9IFwiXCI7XG4iICsKICAgICAgICAgICAgIiAgICAgICAgc2Nyb2xsUGVy" +
        "Zm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJpbmRSZWplY3RSZWFzb25zID0ge307XG4iICsKICAgICAgICAgICAgIiAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VT" +
        "dGF0ZS5ob2xkZXJSZWJpbmRGYWlsdXJlU3RhZ2VzID0ge307XG4iLAogICAgICAgICAgICAiU3RhZ2UxNkIxIG1ldHJpYyByZXNldCIpOwoKICAgICAgICBz" +
        "b3VyY2UgPSByZXBsYWNlT25jZVN0cmljdChzb3VyY2UsCiAgICAgICAgICAgICIgICAgICAgICAgICBob2xkZXJOZXdCdWlsZENvdW50OlxuIiArCiAgICAg" +
        "ICAgICAgICIgICAgICAgICAgICAgICAgTnVtYmVyKHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuaG9sZGVyTmV3QnVpbGRDb3VudCksXG4iICsKICAgICAgICAg" +
        "ICAgIiAgICAgICAgICAgIHBlbmRpbmdPcmlnaW46IHZpcnR1YWxQZW5kaW5nT3JpZ2luLFxuIiwKICAgICAgICAgICAgIiAgICAgICAgICAgIGhvbGRlck5l" +
        "d0J1aWxkQ291bnQ6XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgICAgICBOdW1iZXIoc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJOZXdCdWls" +
        "ZENvdW50KSxcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgaG9sZGVyUmViaW5kQXR0ZW1wdENvdW50OlxuIiArCiAgICAgICAgICAgICIgICAgICAg" +
        "ICAgICAgICAgTnVtYmVyKHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuaG9sZGVyUmViaW5kQXR0ZW1wdENvdW50KSxcbiIgKwogICAgICAgICAgICAiICAgICAg" +
        "ICAgICAgaG9sZGVyUmViaW5kRWxpZ2libGVDb3VudDpcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgICAgIE51bWJlcihzY3JvbGxQZXJmb3JtYW5j" +
        "ZVN0YXRlLmhvbGRlclJlYmluZEVsaWdpYmxlQ291bnQpLFxuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBob2xkZXJSZWJpbmRJbmVsaWdpYmxlQ291" +
        "bnQ6XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgICAgICBOdW1iZXIoc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJpbmRJbmVsaWdpYmxl" +
        "Q291bnQpLFxuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBob2xkZXJSZWJpbmRGYWlsdXJlQ291bnQ6XG4iICsKICAgICAgICAgICAgIiAgICAgICAg" +
        "ICAgICAgICBOdW1iZXIoc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJpbmRGYWlsdXJlQ291bnQpLFxuIiArCiAgICAgICAgICAgICIgICAgICAg" +
        "ICAgICBob2xkZXJSZWJpbmRMYXN0UmVqZWN0UmVhc29uOlxuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICAgICAgU3RyaW5nKHNjcm9sbFBlcmZvcm1h" +
        "bmNlU3RhdGUuaG9sZGVyUmViaW5kTGFzdFJlamVjdFJlYXNvbiB8fCBcIlwiKSxcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgaG9sZGVyUmViaW5k" +
        "TGFzdEZhaWx1cmVTdGFnZTpcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgICAgIFN0cmluZyhzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJl" +
        "YmluZExhc3RGYWlsdXJlU3RhZ2UgfHwgXCJcIiksXG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgIGhvbGRlclJlYmluZExhc3RFcnJvcjpcbiIgKwog" +
        "ICAgICAgICAgICAiICAgICAgICAgICAgICAgIFN0cmluZyhzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJlYmluZExhc3RFcnJvciB8fCBcIlwiKSxc" +
        "biIgKwogICAgICAgICAgICAiICAgICAgICAgICAgaG9sZGVyUmViaW5kUmVqZWN0UmVhc29uczpcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgICAg" +
        "IHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuaG9sZGVyUmViaW5kUmVqZWN0UmVhc29ucyxcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgaG9sZGVyUmVi" +
        "aW5kRmFpbHVyZVN0YWdlczpcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuaG9sZGVyUmViaW5kRmFp" +
        "bHVyZVN0YWdlcyxcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgcGVuZGluZ09yaWdpbjogdmlydHVhbFBlbmRpbmdPcmlnaW4sXG4iLAogICAgICAg" +
        "ICAgICAiU3RhZ2UxNkIxIG1ldHJpYyBjb3B5Iik7CgogICAgICAgIGluZm8gPSBzZWN0aW9uKHNvdXJjZSwKICAgICAgICAgICAgIiAgICBmdW5jdGlvbiBy" +
        "ZWJpbmRSZXN1bHRDYXJkSG9sZGVyKGhvbGRlciwgcm93LCBjb2xvcnMpIHsiLAogICAgICAgICAgICAiXG4gICAgZnVuY3Rpb24gbWFrZVJlc3VsdENhcmQo" +
        "IiwKICAgICAgICAgICAgIlN0YWdlMTZCMSByZWJpbmQgZnVuY3Rpb24iKTsKICAgICAgICB2YWx1ZSA9CiAgICAgICAgICAgICIgICAgZnVuY3Rpb24gbm90" +
        "ZUNhcmRIb2xkZXJSZWJpbmRSZWFzb24obWFwLCByZWFzb24pIHtcbiIgKwogICAgICAgICAgICAiICAgICAgICB2YXIga2V5ID0gU3RyaW5nKHJlYXNvbiB8" +
        "fCBcInVua25vd25cIik7XG4iICsKICAgICAgICAgICAgIiAgICAgICAgaWYgKG1hcFtrZXldID09PSB1bmRlZmluZWQgfHwgbWFwW2tleV0gPT09IG51bGwp" +
        "IHsgbWFwW2tleV0gPSAwOyB9XG4iICsKICAgICAgICAgICAgIiAgICAgICAgbWFwW2tleV0gPSBOdW1iZXIobWFwW2tleV0pICsgMTtcbiIgKwogICAgICAg" +
        "ICAgICAiICAgICAgICByZXR1cm4ga2V5O1xuIiArCiAgICAgICAgICAgICIgICAgfVxuXG4iICsKICAgICAgICAgICAgIiAgICBmdW5jdGlvbiByZWJpbmRS" +
        "ZXN1bHRDYXJkSG9sZGVyKGhvbGRlciwgcm93LCBjb2xvcnMpIHtcbiIgKwogICAgICAgICAgICAiICAgICAgICB2YXIgc3RhcnRlZEF0ID0gTnVtYmVyKFN5" +
        "c3RlbS5jdXJyZW50VGltZU1pbGxpcygpKTtcbiIgKwogICAgICAgICAgICAiICAgICAgICB2YXIgZWxhcHNlZDtcbiIgKwogICAgICAgICAgICAiICAgICAg" +
        "ICB2YXIgc3RhZ2UgPSBcInZhbGlkYXRlXCI7XG4iICsKICAgICAgICAgICAgIiAgICAgICAgdmFyIG9sZFJvdztcbiIgKwogICAgICAgICAgICAiICAgICAg" +
        "ICB2YXIgb2xkVGFncztcbiIgKwogICAgICAgICAgICAiICAgICAgICB2YXIgbmV3VGFncztcbiIgKwogICAgICAgICAgICAiICAgICAgICB2YXIgb2xkU2Vs" +
        "ZWN0ZWQ7XG4iICsKICAgICAgICAgICAgIiAgICAgICAgdmFyIG5ld1NlbGVjdGVkO1xuIiArCiAgICAgICAgICAgICIgICAgICAgIHZhciBvbGRQaW5uZWQ7" +
        "XG4iICsKICAgICAgICAgICAgIiAgICAgICAgdmFyIG5ld1Bpbm5lZDtcbiIgKwogICAgICAgICAgICAiICAgICAgICB2YXIgb2xkUGFja2FnZTtcbiIgKwog" +
        "ICAgICAgICAgICAiICAgICAgICB2YXIgbmV3UGFja2FnZTtcbiIgKwogICAgICAgICAgICAiICAgICAgICB2YXIgb2xkSGFzVGFncztcbiIgKwogICAgICAg" +
        "ICAgICAiICAgICAgICB2YXIgbmV3SGFzVGFncztcbiIgKwogICAgICAgICAgICAiICAgICAgICB2YXIgcmVhc29uID0gXCJcIjtcbiIgKwogICAgICAgICAg" +
        "ICAiICAgICAgICBzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJlYmluZEF0dGVtcHRDb3VudCArPSAxO1xuIiArCiAgICAgICAgICAgICIgICAgICAg" +
        "IGlmIChob2xkZXIgPT09IG51bGwgfHwgaG9sZGVyID09PSB1bmRlZmluZWQgfHwgcm93ID09PSBudWxsIHx8IHJvdyA9PT0gdW5kZWZpbmVkIHx8XG4iICsK" +
        "ICAgICAgICAgICAgIiAgICAgICAgICAgICAgICBob2xkZXIucm93ID09PSBudWxsIHx8IGhvbGRlci5yb3cgPT09IHVuZGVmaW5lZCB8fFxuIiArCiAgICAg" +
        "ICAgICAgICIgICAgICAgICAgICAgICAgaG9sZGVyLmNvbnRlbnRWaWV3ID09PSBudWxsIHx8IGhvbGRlci5jb250ZW50VmlldyA9PT0gdW5kZWZpbmVkIHx8" +
        "XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgICAgICBob2xkZXIudGFnQmFkZ2UgPT09IG51bGwgfHwgaG9sZGVyLnRhZ0JhZGdlID09PSB1bmRlZmlu" +
        "ZWQgfHxcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgICAgIGhvbGRlci5zb3VyY2VWaWV3ID09PSBudWxsIHx8IGhvbGRlci5zb3VyY2VWaWV3ID09" +
        "PSB1bmRlZmluZWQpIHtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgcmVhc29uID0gbm90ZUNhcmRIb2xkZXJSZWJpbmRSZWFzb24oc2Nyb2xsUGVy" +
        "Zm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJpbmRSZWplY3RSZWFzb25zLCBcImludmFsaWRfaG9sZGVyXCIpO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAg" +
        "ICBzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJlYmluZEluZWxpZ2libGVDb3VudCArPSAxO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBz" +
        "Y3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJlYmluZExhc3RSZWplY3RSZWFzb24gPSByZWFzb247XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAg" +
        "IHJldHVybiBmYWxzZTtcbiIgKwogICAgICAgICAgICAiICAgICAgICB9XG4iICsKICAgICAgICAgICAgIiAgICAgICAgdHJ5IHtcbiIgKwogICAgICAgICAg" +
        "ICAiICAgICAgICAgICAgb2xkUm93ID0gaG9sZGVyLnJvdztcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgc3RhZ2UgPSBcImVsaWdpYmlsaXR5XCI7" +
        "XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgIG9sZFNlbGVjdGVkID0gaG9sZGVyLnNlbGVjdGVkID09PSB0cnVlO1xuIiArCiAgICAgICAgICAgICIg" +
        "ICAgICAgICAgICBuZXdTZWxlY3RlZCA9IFNFTEVDVElPTl9FTkFCTEVEICYmIHNlbGVjdGVkSXRlbUlkICE9PSBudWxsICYmIE51bWJlcihzZWxlY3RlZEl0" +
        "ZW1JZCkgPT09IE51bWJlcihyb3cuaWQpO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBvbGRQaW5uZWQgPSBob2xkZXIucGlubmVkID09PSB0cnVl" +
        "O1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBuZXdQaW5uZWQgPSBOdW1iZXIocm93LmlzX3Bpbm5lZCB8fCAwKSA9PT0gMTtcbiIgKwogICAgICAg" +
        "ICAgICAiICAgICAgICAgICAgb2xkUGFja2FnZSA9IFN0cmluZyhob2xkZXIuc291cmNlUGFja2FnZSB8fCBvbGRSb3cuc291cmNlX3BhY2thZ2UgfHwgXCJc" +
        "Iik7XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgIG5ld1BhY2thZ2UgPSBTdHJpbmcocm93LnNvdXJjZV9wYWNrYWdlIHx8IFwiXCIpO1xuIiArCiAg" +
        "ICAgICAgICAgICIgICAgICAgICAgICBvbGRUYWdzID0gdGFnc0ZvclJlc3VsdChvbGRSb3cpO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBuZXdU" +
        "YWdzID0gdGFnc0ZvclJlc3VsdChyb3cpO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBvbGRIYXNUYWdzID0gb2xkVGFncy5sZW5ndGggPiAwO1xu" +
        "IiArCiAgICAgICAgICAgICIgICAgICAgICAgICBuZXdIYXNUYWdzID0gbmV3VGFncy5sZW5ndGggPiAwO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAg" +
        "ICBpZiAob2xkU2VsZWN0ZWQgIT09IG5ld1NlbGVjdGVkKSB7IHJlYXNvbiA9IFwic2VsZWN0ZWRfY2hhbmdlZFwiOyB9XG4iICsKICAgICAgICAgICAgIiAg" +
        "ICAgICAgICAgIGVsc2UgaWYgKG9sZFBpbm5lZCAhPT0gbmV3UGlubmVkKSB7IHJlYXNvbiA9IFwicGlubmVkX2NoYW5nZWRcIjsgfVxuIiArCiAgICAgICAg" +
        "ICAgICIgICAgICAgICAgICBlbHNlIGlmIChvbGRQYWNrYWdlICE9PSBuZXdQYWNrYWdlKSB7IHJlYXNvbiA9IFwic291cmNlX3BhY2thZ2VfY2hhbmdlZFwi" +
        "OyB9XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgIGVsc2UgaWYgKG9sZEhhc1RhZ3MgIT09IG5ld0hhc1RhZ3MpIHsgcmVhc29uID0gXCJ0YWdfcHJl" +
        "c2VuY2VfY2hhbmdlZFwiOyB9XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgIGlmIChyZWFzb24ubGVuZ3RoID4gMCkge1xuIiArCiAgICAgICAgICAg" +
        "ICIgICAgICAgICAgICAgICAgcmVhc29uID0gbm90ZUNhcmRIb2xkZXJSZWJpbmRSZWFzb24oc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJpbmRS" +
        "ZWplY3RSZWFzb25zLCByZWFzb24pO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJp" +
        "bmRJbmVsaWdpYmxlQ291bnQgKz0gMTtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuaG9sZGVyUmVi" +
        "aW5kTGFzdFJlamVjdFJlYXNvbiA9IHJlYXNvbjtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiIgKwogICAgICAg" +
        "ICAgICAiICAgICAgICAgICAgfVxuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJlYmluZEVsaWdp" +
        "YmxlQ291bnQgKz0gMTtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgc3RhZ2UgPSBcImNvbnRlbnRfdGV4dFwiO1xuIiArCiAgICAgICAgICAgICIg" +
        "ICAgICAgICAgICBob2xkZXIuY29udGVudFZpZXcuc2V0VGV4dChTdHJpbmcocmVzdWx0UHJldmlld1RleHQocm93KSkpO1xuIiArCiAgICAgICAgICAgICIg" +
        "ICAgICAgICAgICBzdGFnZSA9IFwidGFnX3RleHRcIjtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgaG9sZGVyLnRhZ0JhZGdlLnNldFRleHQoU3Ry" +
        "aW5nKChuZXdUYWdscy5sZW5ndGggPiAwID8gXCLil48gIFwiIDogXCJcIikgKyB0YWdTdW1tYXJ5KG5ld1RhZ3MpKSk7XG4iICsKICAgICAgICAgICAgIiAg" +
        "ICAgICAgICAgIHN0YWdlID0gXCJ0YWdfY29sb3JcIjtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgaG9sZGVyLnRhZ0JhZGdlLnNldFRleHRDb2xv" +
        "cihuZXdUYWdscy5sZW5ndGggPiAwID8gdGFnQ29sb3JUZXh0KG5ld1RhZ3NbMF0sIGNvbG9ycy5hY2NlbnRTdHJvbmcpIDogY29sb3JzLnRleHRUZXJ0aWFy" +
        "eSk7XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgIHN0YWdlID0gXCJzb3VyY2VfdGV4dFwiO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBo" +
        "b2xkZXIuc291cmNlVmlldy5zZXRUZXh0KFN0cmluZyhzb3VyY2VMYWJlbChyb3cpICsgXCIgwrcgXCIgKyBmb3JtYXRUaW1lKHJvdy5sYXN0X2NvcGllZF9h" +
        "dCkpKTtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgc3RhZ2UgPSBcImNvbW1pdFwiO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBob2xk" +
        "ZXIucm93ID0gcm93O1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBob2xkZXIuaXRlbUlkID0gTnVtYmVyKHJvdy5pZCk7XG4iICsKICAgICAgICAg" +
        "ICAgIiAgICAgICAgICAgIGhvbGRlci5zZWxlY3RlZCA9IG5ld1NlbGVjdGVkO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBob2xkZXIucGlubmVk" +
        "ID0gbmV3UGlubmVkO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBob2xkZXIuc291cmNlUGFja2FnZSA9IG5ld1BhY2thZ2U7XG4iICsKICAgICAg" +
        "ICAgICAgIiAgICAgICAgICAgIGVsYXBzZWQgPSBNYXRoLm1heCgwLCBOdW1iZXIoU3lzdGVtLmN1cnJlbnRUaW1lTWlsbGlzKCkpIC0gc3RhcnRlZEF0KTtc" +
        "biIgKwogICAgICAgICAgICAiICAgICAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJpbmRDb3VudCArPSAxO1xuIiArCiAgICAgICAg" +
        "ICAgICIgICAgICAgICAgICBzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJlYmluZExhc3RNcyA9IGVsYXBzZWQ7XG4iICsKICAgICAgICAgICAgIiAg" +
        "ICAgICAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuaG9sZGVyUmViaW5kTWF4TXMgPSBNYXRoLm1heChOdW1iZXIoc2Nyb2xsUGVyZm9ybWFuY2VTdGF0" +
        "ZS5ob2xkZXJSZWJpbmRNYXhNcyksIGVsYXBzZWQpO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiIgKwogICAgICAgICAg" +
        "ICAiICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJl" +
        "YmluZEZhaWx1cmVDb3VudCArPSAxO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJlYmluZExh" +
        "c3RGYWlsdXJlU3RhZ2UgPSBub3RlQ2FyZEhvbGRlclJlYmluZFJlYXNvbihzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJlYmluZEZhaWx1cmVTdGFn" +
        "ZXMsIHN0YWdlKTtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJpbmRMYXN0RXJyb3IgPSBT" +
        "dHJpbmcoZXJyb3IpO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICB2aXJ0dWFsU3RhdGUubGFzdEVycm9yID0gXCJDYXJkSG9sZGVyIHJlYmluZCBm" +
        "YWlsZWQgYXQgXCIgKyBzdGFnZSArIFwiOiBcIiArIFN0cmluZyhlcnJvcik7XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgIHJldHVybiBmYWxzZTtc" +
        "biIgKwogICAgICAgICAgICAiICAgICAgICB9XG4iICsKICAgICAgICAgICAgIiAgICB9XG4iOwogICAgICAgIHNvdXJjZSA9IHJlcGxhY2VTZWN0aW9uKHNv" +
        "dXJjZSwgaW5mbywgdmFsdWUpOwoKICAgICAgICBpZiAoc291cmNlLmluZGV4T2YoIk1PRFVMRV9WRVJTSU9OOiA2MCIpIDwgMCB8fAogICAgICAgICAgICAg" +
        "ICAgc291cmNlLmluZGV4T2YoImhvbGRlclJlYmluZEF0dGVtcHRDb3VudCIpIDwgMCB8fAogICAgICAgICAgICAgICAgc291cmNlLmluZGV4T2YoImhvbGRl" +
        "clJlYmluZEZhaWx1cmVTdGFnZXMiKSA8IDAgfHwKICAgICAgICAgICAgICAgIHNvdXJjZS5pbmRleE9mKCJob2xkZXIuY29udGVudFZpZXcuc2V0VGV4dChT" +
        "dHJpbmcocmVzdWx0UHJldmlld1RleHQocm93KSkpIikgPCAwKSB7CiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigiU3RhZ2UxNkIxIHNhZmUgcmViaW5k" +
        "IHdpcmluZyBpbmNvbXBsZXRlIik7CiAgICAgICAgfQogICAgICAgIHJldHVybiBzb3VyY2U7CiAgICB9CgpmdW5jdGlvbiB0cmFuc2Zvcm1TdGFnZTE2QjJT" +
        "b3VyY2Uoc291cmNlKSB7CiAgICAgICAgdmFyIG9sZEFsaWdubWVudDsKICAgICAgICB2YXIgbmV3QWxpZ25tZW50OwogICAgICAgIHNvdXJjZSA9IHJlcGxh" +
        "Y2VPbmNlU3RyaWN0KHNvdXJjZSwKICAiTU9EVUxFX1ZFUlNJT046IDYwIiwgIk1PRFVMRV9WRVJTSU9OOiA2MSIsCiAgIlN0YWdlMTZCMiBtb2R1bGUgdmVy" +
        "c2lvbiIpOwogICAgICAgIHNvdXJjZSA9IHJlcGxhY2VPbmNlU3RyaWN0KHNvdXJjZSwKICAiICAgICAgICBhbGlnbm1lbnRGYWxsYmFja0NvdW50OiAwLFxu" +
        "IiwKICAiICAgICAgICBhbGlnbm1lbnRGYWxsYmFja0NvdW50OiAwLFxuIiArCiAgIiAgICAgICAgYWxpZ25tZW50RmFsbGJhY2tMYXN0UmVhc29uOiBcIlwi" +
        "LFxuIiArCiAgIiAgICAgICAgYWxpZ25tZW50RmFsbGJhY2tSZWFzb25Db3VudHM6IHt9LFxuIiArCiAgIiAgICAgICAgYWxpZ25tZW50RmFsbGJhY2tMYXN0" +
        "U25hcHNob3Q6IG51bGwsXG4iICsKICAiICAgICAgICBmdWxsUmVmcmVzaENhbGxDb3VudDogMCxcbiIgKwogICIgICAgICAgIGZ1bGxSZWZyZXNoTGFzdFBl" +
        "cmZvcm1hbmNlT3JpZ2luOiBcIlwiLFxuIiArCiAgIiAgICAgICAgZnVsbFJlZnJlc2hMYXN0UHJlZmVycmVkSW5kZXg6IC0xLFxuIiArCiAgIiAgICAgICAg" +
        "ZnVsbFJlZnJlc2hMYXN0UHJldmlld1Jvd0NvdW50OiAwLFxuIiArCiAgIiAgICAgICAgZnVsbFJlZnJlc2hMYXN0UmVuZGVyZWRDb3VudDogMCxcbiIgKwog" +
        "ICIgICAgICAgIGZ1bGxSZWZyZXNoTGFzdENoaWxkQ291bnQ6IDAsXG4iLAogICJTdGFnZTE2QjIgbWV0cmljcyIpOwogICAgICAgIHNvdXJjZSA9IHJlcGxh" +
        "Y2VPbmNlU3RyaWN0KHNvdXJjZSwKICAiICAgICAgICBzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmFsaWdubWVudEZhbGxiYWNrQ291bnQgPSAwO1xuIiwKICAi" +
        "ICAgICAgICBzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmFsaWdubWVudEZhbGxiYWNrQ291bnQgPSAwO1xuIiArCiAgIiAgICAgICAgc2Nyb2xsUGVyZm9ybWFu" +
        "Y2VTdGF0ZS5hbGlnbm1lbnRGYWxsYmFja0xhc3RSZWFzb24gPSBcIlwiO1xuIiArCiAgIiAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5hbGlnbm1l" +
        "bnRGYWxsYmFja1JlYXNvbkNvdW50cyA9IHt9O1xuIiArCiAgIiAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5hbGlnbm1lbnRGYWxsYmFja0xhc3RT" +
        "bmFwc2hvdCA9IG51bGw7XG4iICsKICAiICAgICAgICBzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmZ1bGxSZWZyZXNoQ2FsbENvdW50ID0gMDtcbiIgKwogICIg" +
        "ICAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuZnVsbFJlZnJlc2hMYXN0UGVyZm9ybWFuY2VPcmlnaW4gPSBcIlwiO1xuIiArCiAgIiAgICAgICAgc2Ny" +
        "b2xsUGVyZm9ybWFuY2VTdGF0ZS5mdWxsUmVmcmVzaExhc3RQcmVmZXJyZWRJbmRleCA9IC0xO1xuIiArCiAgIiAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VT" +
        "dGF0ZS5mdWxsUmVmcmVzaExhc3RQcmV2aWV3Um93Q291bnQgPSAwO1xuIiArCiAgIiAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5mdWxsUmVmcmVz" +
        "aExhc3RSZW5kZXJlZENvdW50ID0gMDtcbiIgKwogICIgICAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuZnVsbFJlZnJlc2hMYXN0Q2hpbGRDb3VudCA9" +
        "IDA7XG4iLAogICJTdGFnZTE2QjIgbWV0cmljIHJlc2V0Iik7CiAgICAgICAgc291cmNlID0gcmVwbGFjZU9uY2VTdHJpY3Qoc291cmNlLAogICIgICAgICAg" +
        "ICAgICBhbGlnbm1lbnRGYWxsYmFja0NvdW50OlxuIiArCiAgIiAgICAgICAgICAgICAgICBOdW1iZXIoc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5hbGlnbm1l" +
        "bnRGYWxsYmFja0NvdW50KSxcbiIgKwogICIgICAgICAgICAgICBzcGFjZXJBcHBseUNvdW50OlxuIiwKICAiICAgICAgICAgICAgYWxpZ25tZW50RmFsbGJh" +
        "Y2tDb3VudDpcbiIgKwogICIgICAgICAgICAgICAgICAgTnVtYmVyKHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuYWxpZ25tZW50RmFsbGJhY2tDb3VudCksXG4i" +
        "ICsKICAiICAgICAgICAgICAgYWxpZ25tZW50RmFsbGJhY2tMYXN0UmVhc29uOlxuIiArCiAgIiAgICAgICAgICAgICAgICBTdHJpbmcoc2Nyb2xsUGVyZm9y" +
        "bWFuY2VTdGF0ZS5hbGlnbm1lbnRGYWxsYmFja0xhc3RSZWFzb24gfHwgXCJcIiksXG4iICsKICAiICAgICAgICAgICAgYWxpZ25tZW50RmFsbGJhY2tSZWFz" +
        "b25Db3VudHM6XG4iICsKICAiICAgICAgICAgICAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuYWxpZ25tZW50RmFsbGJhY2tSZWFzb25Db3VudHMsXG4i" +
        "ICsKICAiICAgICAgICAgICAgYWxpZ25tZW50RmFsbGJhY2tMYXN0U25hcHNob3Q6XG4iICsKICAiICAgICAgICAgICAgICAgIHNjcm9sbFBlcmZvcm1hbmNl" +
        "U3RhdGUuYWxpZ25tZW50RmFsbGJhY2tMYXN0U25hcHNob3QsXG4iICsKICAiICAgICAgICAgICAgZnVsbFJlZnJlc2hDYWxsQ291bnQ6XG4iICsKICAiICAg" +
        "ICAgICAgICAgICAgIE51bWJlcihzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmZ1bGxSZWZyZXNoQ2FsbENvdW50KSxcbiIgKwogICIgICAgICAgICAgICBmdWxs" +
        "UmVmcmVzaExhc3RQZXJmb3JtYW5jZU9yaWdpbjpcbiIgKwogICIgICAgICAgICAgICAgICAgU3RyaW5nKHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuZnVsbFJl" +
        "ZnJlc2hMYXN0UGVyZm9ybWFuY2VPcmlnaW4gfHwgXCJcIiksXG4iICsKICAiICAgICAgICAgICAgZnVsbFJlZnJlc2hMYXN0UHJlZmVycmVkSW5kZXg6XG4i" +
        "ICsKICAiICAgICAgICAgICAgICAgIE51bWJlcihzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmZ1bGxSZWZyZXNoTGFzdFByZWZlcnJlZEluZGV4KSxcbiIgKwog" +
        "ICIgICAgICAgICAgICBmdWxsUmVmcmVzaExhc3RQcmV2aWV3Um93Q291bnQ6XG4iICsKICAiICAgICAgICAgICAgICAgIE51bWJlcihzY3JvbGxQZXJmb3Jt" +
        "YW5jZVN0YXRlLmZ1bGxSZWZyZXNoTGFzdFByZXZpZXdSb3dDb3VudCksXG4iICsKICAiICAgICAgICAgICAgZnVsbFJlZnJlc2hMYXN0UmVuZGVyZWRDb3Vu" +
        "dDpcbiIgKwogICIgICAgICAgICAgICAgICAgTnVtYmVyKHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuZnVsbFJlZnJlc2hMYXN0UmVuZGVyZWRDb3VudCksXG4i" +
        "ICsKICAiICAgICAgICAgICAgZnVsbFJlZnJlc2hMYXN0Q2hpbGRDb3VudDpcbiIgKwogICIgICAgICAgICAgICAgICAgTnVtYmVyKHNjcm9sbFBlcmZvcm1h" +
        "bmNlU3RhdGUuZnVsbFJlZnJlc2hMYXN0Q2hpbGRDb3VudCksXG4iICsKICAiICAgICAgICAgICAgc3BhY2VyQXBwbHlDb3VudDpcbiIsCiAgIlN0YWdlMTZC" +
        "MiBtZXRyaWMgY29weSIpOwoKICAgICAgICBvbGRBbGlnbm1lbnQgPQogICIgICAgICAgIGlmICh2aXJ0dWFsUmVuZGVyZWRJdGVtSWRzLmxlbmd0aCAhPT0g" +
        "Y2hpbGRDb3VudCB8fFxuIiArCiAgIiAgICAgIHZpcnR1YWxSZW5kZXJlZFNpZ25hdHVyZXMubGVuZ3RoICE9PSBjaGlsZENvdW50IHx8XG4iICsKICAiICAg" +
        "ICAgcmVzdWx0Q2FyZFZpZXdzLmxlbmd0aCAhPT0gY2hpbGRDb3VudCB8fFxuIiArCiAgIiAgICAgIHJlc3VsdENhcmRIb2xkZXJzLmxlbmd0aCAhPT0gY2hp" +
        "bGRDb3VudCB8fFxuIiArCiAgIiAgICAgIHJlc3VsdEFjdGlvblZpZXdzLmxlbmd0aCAhPT0gY2hpbGRDb3VudCkge1xuIiArCiAgIiAgc2Nyb2xsUGVyZm9y" +
        "bWFuY2VTdGF0ZS5hbGlnbm1lbnRGYWxsYmFja0NvdW50ICs9IDE7XG4iOwogICAgICAgIG5ld0FsaWdubWVudCA9CiAgIiAgICAgICAgaWYgKHZpcnR1YWxS" +
        "ZW5kZXJlZEl0ZW1JZHMubGVuZ3RoICE9PSBjaGlsZENvdW50IHx8XG4iICsKICAiICAgICAgdmlydHVhbFJlbmRlcmVkU2lnbmF0dXJlcy5sZW5ndGggIT09" +
        "IGNoaWxkQ291bnQgfHxcbiIgKwogICIgICAgICByZXN1bHRDYXJkVmlld3MubGVuZ3RoICE9PSBjaGlsZENvdW50IHx8XG4iICsKICAiICAgICAgcmVzdWx0" +
        "Q2FyZEhvbGRlcnMubGVuZ3RoICE9PSBjaGlsZENvdW50IHx8XG4iICsKICAiICAgICAgcmVzdWx0QWN0aW9uVmlld3MubGVuZ3RoICE9PSBjaGlsZENvdW50" +
        "KSB7XG4iICsKICAiICB2YXIgYWxpZ25tZW50UmVhc29ucyA9IFtdO1xuIiArCiAgIiAgdmFyIGFsaWdubWVudEtleTtcbiIgKwogICIgIGlmICh2aXJ0dWFs" +
        "UmVuZGVyZWRJdGVtSWRzLmxlbmd0aCAhPT0gY2hpbGRDb3VudCkgeyBhbGlnbm1lbnRSZWFzb25zLnB1c2goXCJpdGVtSWRzXCIpOyB9XG4iICsKICAiICBp" +
        "ZiAodmlydHVhbFJlbmRlcmVkU2lnbmF0dXJlcy5sZW5ndGggIT09IGNoaWxkQ291bnQpIHsgYWxpZ25tZW50UmVhc29ucy5wdXNoKFwic2lnbmF0dXJlc1wi" +
        "KTsgfVxuIiArCiAgIiAgaWYgKHJlc3VsdENhcmRWaWV3cy5sZW5ndGggIT09IGNoaWxkQ291bnQpIHsgYWxpZ25tZW50UmVhc29ucy5wdXNoKFwiY2FyZFZp" +
        "ZXdzXCIpOyB9XG4iICsKICAiICBpZiAocmVzdWx0Q2FyZEhvbGRlcnMubGVuZ3RoICE9PSBjaGlsZENvdW50KSB7IGFsaWdubWVudFJlYXNvbnMucHVzaChc" +
        "ImhvbGRlcnNcIik7IH1cbiIgKwogICIgIGlmIChyZXN1bHRBY3Rpb25WaWV3cy5sZW5ndGggIT09IGNoaWxkQ291bnQpIHsgYWxpZ25tZW50UmVhc29ucy5w" +
        "dXNoKFwiYWN0aW9uVmlld3NcIik7IH1cbiIgKwogICIgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuYWxpZ25tZW50RmFsbGJhY2tMYXN0UmVhc29uID0gYWxp" +
        "Z25tZW50UmVhc29ucy5qb2luKFwiK1wiKTtcbiIgKwogICIgIGZvciAoYWxpZ25tZW50S2V5ID0gMDsgYWxpZ25tZW50S2V5IDwgYWxpZ25tZW50UmVhc29u" +
        "cy5sZW5ndGg7IGFsaWdubWVudEtleSArPSAxKSB7XG4iICsKICAiICAgICAgaWYgKHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuYWxpZ25tZW50RmFsbGJhY2tS" +
        "ZWFzb25Db3VudHNbYWxpZ25tZW50UmVhc29uc1thbGlnbm1lbnRLZXldXSA9PT0gdW5kZWZpbmVkKSB7XG4iICsKICAiICAgICAgICAgIHNjcm9sbFBlcmZv" +
        "cm1hbmNlU3RhdGUuYWxpZ25tZW50RmFsbGJhY2tSZWFzb25Db3VudHNbYWxpZ25tZW50UmVhc29uc1thbGlnbm1lbnRLZXldXSA9IDA7XG4iICsKICAiICAg" +
        "ICAgfVxuIiArCiAgIiAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuYWxpZ25tZW50RmFsbGJhY2tSZWFzb25Db3VudHNbYWxpZ25tZW50UmVhc29uc1th" +
        "bGlnbm1lbnRLZXldXSArPSAxO1xuIiArCiAgIiAgfVxuIiArCiAgIiAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5hbGlnbm1lbnRGYWxsYmFja0xhc3RTbmFw" +
        "c2hvdCA9IHtcbiIgKwogICIgICAgICBjaGlsZENvdW50OiBjaGlsZENvdW50LFxuIiArCiAgIiAgICAgIGl0ZW1JZHM6IHZpcnR1YWxSZW5kZXJlZEl0ZW1J" +
        "ZHMubGVuZ3RoLFxuIiArCiAgIiAgICAgIHNpZ25hdHVyZXM6IHZpcnR1YWxSZW5kZXJlZFNpZ25hdHVyZXMubGVuZ3RoLFxuIiArCiAgIiAgICAgIGNhcmRW" +
        "aWV3czogcmVzdWx0Q2FyZFZpZXdzLmxlbmd0aCxcbiIgKwogICIgICAgICBob2xkZXJzOiByZXN1bHRDYXJkSG9sZGVycy5sZW5ndGgsXG4iICsKICAiICAg" +
        "ICAgYWN0aW9uVmlld3M6IHJlc3VsdEFjdGlvblZpZXdzLmxlbmd0aFxuIiArCiAgIiAgfTtcbiIgKwogICIgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuYWxp" +
        "Z25tZW50RmFsbGJhY2tDb3VudCArPSAxO1xuIjsKICAgICAgICBzb3VyY2UgPSByZXBsYWNlT25jZVN0cmljdChzb3VyY2UsIG9sZEFsaWdubWVudCwgbmV3" +
        "QWxpZ25tZW50LAogICJTdGFnZTE2QjIgYWxpZ25tZW50IGRpYWdub3N0aWNzIik7CgogICAgICAgIHNvdXJjZSA9IHJlcGxhY2VPbmNlU3RyaWN0KHNvdXJj" +
        "ZSwKICAiICAgICAgICByZWJ1aWxkVmlydHVhbFdpbmRvdyhcbiIgKwogICIgICAgICAgICAgICBcImZ1bGxfcmVmcmVzaFwiLCB0cnVlLCBwcmVmZXJyZWRJ" +
        "bmRleCk7XG4iLAogICIgICAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuZnVsbFJlZnJlc2hDYWxsQ291bnQgKz0gMTtcbiIgKwogICIgICAgICAgIHNj" +
        "cm9sbFBlcmZvcm1hbmNlU3RhdGUuZnVsbFJlZnJlc2hMYXN0UGVyZm9ybWFuY2VPcmlnaW4gPVxuIiArCiAgIiAgICAgICAgICAgIFN0cmluZyhwZXJmb3Jt" +
        "YW5jZS5sYXN0UmVmcmVzaE9yaWdpbiB8fCBcIlwiKTtcbiIgKwogICIgICAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuZnVsbFJlZnJlc2hMYXN0UHJl" +
        "ZmVycmVkSW5kZXggPSBOdW1iZXIocHJlZmVycmVkSW5kZXgpO1xuIiArCiAgIiAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5mdWxsUmVmcmVzaExh" +
        "c3RQcmV2aWV3Um93Q291bnQgPSBOdW1iZXIocHJldmlld1Jvd3MubGVuZ3RoKTtcbiIgKwogICIgICAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuZnVs" +
        "bFJlZnJlc2hMYXN0UmVuZGVyZWRDb3VudCA9XG4iICsKICAiICAgICAgICAgICAgTWF0aC5tYXgoMCwgTnVtYmVyKHZpcnR1YWxTdGF0ZS5sYXN0UmVuZGVy" +
        "ZWRJbmRleCkgLVxuIiArCiAgIiAgICAgICAgICAgICAgICBOdW1iZXIodmlydHVhbFN0YXRlLmZpcnN0UmVuZGVyZWRJbmRleCkgKyAxKTtcbiIgKwogICIg" +
        "ICAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuZnVsbFJlZnJlc2hMYXN0Q2hpbGRDb3VudCA9IHZpcnR1YWxDYXJkSG9zdCA9PT0gbnVsbCA/XG4iICsK" +
        "ICAiICAgICAgICAgICAgLTEgOiBOdW1iZXIodmlydHVhbENhcmRIb3N0LmdldENoaWxkQ291bnQoKSk7XG4iICsKICAiICAgICAgICByZWJ1aWxkVmlydHVh" +
        "bFdpbmRvdyhcbiIgKwogICIgICAgICAgICAgICBcImZ1bGxfcmVmcmVzaFwiLCB0cnVlLCBwcmVmZXJyZWRJbmRleCk7XG4iLAogICJTdGFnZTE2QjIgZnVs" +
        "bCByZWZyZXNoIGRpYWdub3N0aWNzIik7CiAgICAgICAgaWYgKHNvdXJjZS5pbmRleE9mKCJvbGRUYWdscyIpID49IDAgfHwKICAgICAgc291cmNlLmluZGV4" +
        "T2YoIk1PRFVMRV9WRVJTSU9OOiA2MSIpIDwgMCB8fAogICAgICBzb3VyY2UuaW5kZXhPZigiYWxpZ25tZW50RmFsbGJhY2tSZWFzb25Db3VudHMiKSA8IDAg" +
        "fHwKICAgICAgc291cmNlLmluZGV4T2YoImZ1bGxSZWZyZXNoQ2FsbENvdW50IikgPCAwKSB7CiAgdGhyb3cgbmV3IEVycm9yKCJTdGFnZTE2QjIgd2lyaW5n" +
        "IGluY29tcGxldGUiKTsKICAgICAgICB9CiAgICAgICAgcmV0dXJuIHNvdXJjZTsKICAgIH0K";


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
            connection = new URL(BASE_URL + "?stage16b2v15=" +
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

    function patchSourceText() {
        return String(new JavaString(
            Base64.decode(String(PATCH_B64), Base64.DEFAULT), "UTF-8"));
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
        var oldEval =
            "    try {\n" +
            "        eval(transformRecycleSource(\n" +
            "            transformCardHolderSource(\n" +
            "                transformSource(decodeSource(loadPackedSource())))));\n";
        var newEval =
  patchSourceText() + "\n" +
  "    try {\n" +
  "        eval(transformStage16B2Source(\n" +
  "            transformRecycleFixSource(\n" +
  "                transformRecycleSource(\n" +
  "                    transformCardHolderSource(\n" +
  "                        transformSource(decodeSource(loadPackedSource())))))));\n";
        loader = replaceOnce(loader, oldEval, newEval, "baseline eval");
        loader = loader.replace(
            "ch_11_filter.js Stage 16B loader failed:",
            "ch_11_filter.js Stage 16B.2 loader failed:");
        return loader;
    }

    try {
        eval(transformBaselineLoader(loadBaseline()));
    } catch (error) {
        throw new Error("ch_11_filter.js Stage 16B.2 wrapper failed: " +
            String(error));
    }
}((function () { return this; }())));
