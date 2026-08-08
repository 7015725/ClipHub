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
        "YWdzID0gdGFnc0ZvclJlc3VsdChyb3cpO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBvbGRIYXNUYWdzID0gb2xkVGFnbHMubGVuZ3RoID4gMDtc" +
        "biIgKwogICAgICAgICAgICAiICAgICAgICAgICAgbmV3SGFzVGFncyA9IG5ld1RhZ3MubGVuZ3RoID4gMDtcbiIgKwogICAgICAgICAgICAiICAgICAgICAg" +
        "ICAgaWYgKG9sZFNlbGVjdGVkICE9PSBuZXdTZWxlY3RlZCkgeyByZWFzb24gPSBcInNlbGVjdGVkX2NoYW5nZWRcIjsgfVxuIiArCiAgICAgICAgICAgICIg" +
        "ICAgICAgICAgICBlbHNlIGlmIChvbGRQaW5uZWQgIT09IG5ld1Bpbm5lZCkgeyByZWFzb24gPSBcInBpbm5lZF9jaGFuZ2VkXCI7IH1cbiIgKwogICAgICAg" +
        "ICAgICAiICAgICAgICAgICAgZWxzZSBpZiAob2xkUGFja2FnZSAhPT0gbmV3UGFja2FnZSkgeyByZWFzb24gPSBcInNvdXJjZV9wYWNrYWdlX2NoYW5nZWRc" +
        "IjsgfVxuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBlbHNlIGlmIChvbGRIYXNUYWdzICE9PSBuZXdIYXNUYWdzKSB7IHJlYXNvbiA9IFwidGFnX3By" +
        "ZXNlbmNlX2NoYW5nZWRcIjsgfVxuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBpZiAocmVhc29uLmxlbmd0aCA+IDApIHtcbiIgKwogICAgICAgICAg" +
        "ICAiICAgICAgICAgICAgICAgIHJlYXNvbiA9IG5vdGVDYXJkSG9sZGVyUmViaW5kUmVhc29uKHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuaG9sZGVyUmViaW5k" +
        "UmVqZWN0UmVhc29ucywgcmVhc29uKTtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuaG9sZGVyUmVi" +
        "aW5kSW5lbGlnaWJsZUNvdW50ICs9IDE7XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgICAgICBzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJl" +
        "YmluZExhc3RSZWplY3RSZWFzb24gPSByZWFzb247XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4iICsKICAgICAg" +
        "ICAgICAgIiAgICAgICAgICAgIH1cbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJpbmRFbGln" +
        "aWJsZUNvdW50ICs9IDE7XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgIHN0YWdlID0gXCJjb250ZW50X3RleHRcIjtcbiIgKwogICAgICAgICAgICAi" +
        "ICAgICAgICAgICAgaG9sZGVyLmNvbnRlbnRWaWV3LnNldFRleHQoU3RyaW5nKHJlc3VsdFByZXZpZXdUZXh0KHJvdykpKTtcbiIgKwogICAgICAgICAgICAi" +
        "ICAgICAgICAgICAgc3RhZ2UgPSBcInRhZ190ZXh0XCI7XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgIGhvbGRlci50YWdCYWRnZS5zZXRUZXh0KFN0" +
        "cmluZygobmV3VGFnbHMubGVuZ3RoID4gMCA/IFwi4pePICBcIiA6IFwiXCIpICsgdGFnU3VtbWFyeShuZXdUYWdzKSkpO1xuIiArCiAgICAgICAgICAgICIg" +
        "ICAgICAgICAgICBzdGFnZSA9IFwidGFnX2NvbG9yXCI7XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgIGhvbGRlci50YWdCYWRnZS5zZXRUZXh0Q29sb3I" +
        "obmV3VGFnbHMubGVuZ3RoID4gMCA/IHRhZ0NvbG9yVGV4dChuZXdUYWdzWzBdLCBjb2xvcnMuYWNjZW50U3Ryb25nKSA6IGNvbG9ycy50ZXh0VGVydGlh" +
        "cnkpO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICBzdGFnZSA9IFwic291cmNlX3RleHRcIjtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAg" +
        "aG9sZGVyLnNvdXJjZVZpZXcuc2V0VGV4dChTdHJpbmcoc291cmNlTGFiZWwocm93KSArIFwiIMK3IFwiICsgZm9ybWF0VGltZShyb3cubGFzdF9jb3BpZWRf" +
        "YXQpKSk7XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgIHN0YWdlID0gXCJjb21taXRcIjtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgaG9s" +
        "ZGVyLnJvdyA9IHJvdztcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgaG9sZGVyLml0ZW1JZCA9IE51bWJlcihyb3cuaWQpO1xuIiArCiAgICAgICAg" +
        "ICAgICIgICAgICAgICAgICBob2xkZXIuc2VsZWN0ZWQgPSBuZXdTZWxlY3RlZDtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgaG9sZGVyLnBpbm5l" +
        "ZCA9IG5ld1Bpbm5lZDtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgaG9sZGVyLnNvdXJjZVBhY2thZ2UgPSBuZXdQYWNrYWdlO1xuIiArCiAgICAg" +
        "ICAgICAgICIgICAgICAgICAgICBlbGFwc2VkID0gTWF0aC5tYXgoMCwgTnVtYmVyKFN5c3RlbS5jdXJyZW50VGltZU1pbGxpcygpKSAtIHN0YXJ0ZWRBdCk7" +
        "XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuaG9sZGVyUmViaW5kQ291bnQgKz0gMTtcbiIgKwogICAgICAg" +
        "ICAgICAiICAgICAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJpbmRMYXN0TXMgPSBlbGFwc2VkO1xuIiArCiAgICAgICAgICAgICIg" +
        "ICAgICAgICAgICBzY3JvbGxQZXJmb3JtYW5jZVN0YXRlLmhvbGRlclJlYmluZE1heE1zID0gTWF0aC5tYXgoTnVtYmVyKHNjcm9sbFBlcmZvcm1hbmNlU3Rh" +
        "dGUuaG9sZGVyUmViaW5kTWF4TXMpLCBlbGFwc2VkKTtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4iICsKICAgICAgICAg" +
        "ICAgIiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJS" +
        "ZWJpbmRGYWlsdXJlQ291bnQgKz0gMTtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJpbmRM" +
        "YXN0RmFpbHVyZVN0YWdlID0gbm90ZUNhcmRIb2xkZXJSZWJpbmRSZWFzb24oc2Nyb2xsUGVyZm9ybWFuY2VTdGF0ZS5ob2xkZXJSZWJpbmRGYWlsdXJlU3Rh" +
        "Z2VzLCBzdGFnZSk7XG4iICsKICAgICAgICAgICAgIiAgICAgICAgICAgIHNjcm9sbFBlcmZvcm1hbmNlU3RhdGUuaG9sZGVyUmViaW5kTGFzdEVycm9yID0g" +
        "U3RyaW5nKGVycm9yKTtcbiIgKwogICAgICAgICAgICAiICAgICAgICAgICAgdmlydHVhbFN0YXRlLmxhc3RFcnJvciA9IFwiQ2FyZEhvbGRlciByZWJpbmQg" +
        "ZmFpbGVkIGF0IFwiICsgc3RhZ2UgKyBcIjogXCIgKyBTdHJpbmcoZXJyb3IpO1xuIiArCiAgICAgICAgICAgICIgICAgICAgICAgICByZXR1cm4gZmFsc2U7" +
        "XG4iICsKICAgICAgICAgICAgIiAgICAgICAgfVxuIiArCiAgICAgICAgICAgICIgICAgfVxuIjsKICAgICAgICBzb3VyY2UgPSByZXBsYWNlU2VjdGlvbihzb3Vy" +
        "Y2UsIGluZm8sIHZhbHVlKTsKCiAgICAgICAgaWYgKHNvdXJjZS5pbmRleE9mKCJNT0RVTEVfVkVSU0lPTjogNjAiKSA8IDAgfHwKICAgICAgICAgICAgICAg" +
        "IHNvdXJjZS5pbmRleE9mKCJob2xkZXJSZWJpbmRBdHRlbXB0Q291bnQiKSA8IDAgfHwKICAgICAgICAgICAgICAgIHNvdXJjZS5pbmRleE9mKCJob2xkZXJS" +
        "ZWJpbmRGYWlsdXJlU3RhZ2VzIikgPCAwIHx8CiAgICAgICAgICAgICAgICBzb3VyY2UuaW5kZXhPZigiaG9sZGVyLmNvbnRlbnRWaWV3LnNldFRleHQoU3Ry" +
        "aW5nKHJlc3VsdFByZXZpZXdUZXh0KHJvdykpKSIpIDwgMCkgewogICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoIlN0YWdlMTZCMSBzYWZlIHJlYmluZCB3" +
        "aXJpbmcgaW5jb21wbGV0ZSIpOwogICAgICAgIH0KICAgICAgICByZXR1cm4gc291cmNlOwogICAgfQo=";

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
            "        eval(transformRecycleFixSource(\n" +
            "            transformRecycleSource(\n" +
            "                transformCardHolderSource(\n" +
            "                    transformSource(decodeSource(loadPackedSource()))))));\n";
        loader = replaceOnce(loader, oldEval, newEval, "baseline eval");
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
