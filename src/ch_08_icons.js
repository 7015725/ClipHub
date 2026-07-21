// @version 1.0.0
// ClipHub - 自绘图标，避免字体符号和 OEM 图标差异
(function (CH) {
    "use strict";

    var base = CH.base;
    var icons = {};

    function drawIcon(canvas, paint, path, type) {
        paint.setStyle(android.graphics.Paint.Style.STROKE);
        paint.setStrokeWidth(1.8);
        paint.setStrokeCap(android.graphics.Paint.Cap.ROUND);
        paint.setStrokeJoin(android.graphics.Paint.Join.ROUND);
        path.reset();

        if (type === "clipboard") {
            canvas.drawRoundRect(5, 4, 19, 21, 2, 2, paint);
            canvas.drawRoundRect(8, 2, 16, 7, 2, 2, paint);
            canvas.drawLine(9, 11, 16, 11, paint);
            canvas.drawLine(9, 15, 16, 15, paint);
            return;
        }
        if (type === "search") {
            canvas.drawCircle(10, 10, 5.5, paint);
            canvas.drawLine(14.2, 14.2, 20, 20, paint);
            return;
        }
        if (type === "filter") {
            canvas.drawLine(4, 6, 20, 6, paint);
            canvas.drawLine(7, 12, 17, 12, paint);
            canvas.drawLine(10, 18, 14, 18, paint);
            return;
        }
        if (type === "plus") {
            canvas.drawLine(12, 5, 12, 19, paint);
            canvas.drawLine(5, 12, 19, 12, paint);
            return;
        }
        if (type === "pin") {
            path.moveTo(8, 4);
            path.lineTo(16, 4);
            path.lineTo(15, 10);
            path.lineTo(19, 14);
            path.lineTo(13, 14);
            path.lineTo(12, 21);
            path.lineTo(11, 14);
            path.lineTo(5, 14);
            path.lineTo(9, 10);
            path.close();
            canvas.drawPath(path, paint);
            return;
        }
        if (type === "settings") {
            canvas.drawCircle(12, 12, 3.2, paint);
            canvas.drawCircle(12, 12, 8.2, paint);
            canvas.drawLine(12, 2, 12, 5, paint);
            canvas.drawLine(12, 19, 12, 22, paint);
            canvas.drawLine(2, 12, 5, 12, paint);
            canvas.drawLine(19, 12, 22, 12, paint);
            return;
        }
        if (type === "star") {
            path.moveTo(12, 3);
            path.lineTo(14.7, 8.6);
            path.lineTo(21, 9.5);
            path.lineTo(16.4, 13.9);
            path.lineTo(17.5, 20.2);
            path.lineTo(12, 17.2);
            path.lineTo(6.5, 20.2);
            path.lineTo(7.6, 13.9);
            path.lineTo(3, 9.5);
            path.lineTo(9.3, 8.6);
            path.close();
            canvas.drawPath(path, paint);
            return;
        }
        if (type === "more") {
            paint.setStyle(android.graphics.Paint.Style.FILL);
            canvas.drawCircle(12, 5.5, 1.4, paint);
            canvas.drawCircle(12, 12, 1.4, paint);
            canvas.drawCircle(12, 18.5, 1.4, paint);
            return;
        }
        if (type === "edit") {
            path.moveTo(5, 18);
            path.lineTo(6, 13.8);
            path.lineTo(15.6, 4.2);
            path.lineTo(19.8, 8.4);
            path.lineTo(10.2, 18);
            path.close();
            canvas.drawPath(path, paint);
            canvas.drawLine(14.5, 5.3, 18.7, 9.5, paint);
            return;
        }
        if (type === "delete") {
            canvas.drawRoundRect(7, 7, 17, 21, 1.5, 1.5, paint);
            canvas.drawLine(5, 6, 19, 6, paint);
            canvas.drawLine(9, 3.5, 15, 3.5, paint);
            canvas.drawLine(10, 10, 10, 18, paint);
            canvas.drawLine(14, 10, 14, 18, paint);
            return;
        }
        if (type === "translate") {
            canvas.drawLine(4, 5, 13, 5, paint);
            canvas.drawLine(8.5, 3, 8.5, 7, paint);
            canvas.drawLine(5.5, 9, 11.5, 9, paint);
            path.moveTo(6, 9);
            path.cubicTo(7, 13, 10, 15, 13, 16);
            canvas.drawPath(path, paint);
            path.reset();
            path.moveTo(11, 9);
            path.cubicTo(10, 13, 7.5, 15, 4, 16.5);
            canvas.drawPath(path, paint);
            canvas.drawLine(15, 10, 20, 21, paint);
            canvas.drawLine(17.5, 16.5, 21, 16.5, paint);
            return;
        }
        if (type === "drag") {
            paint.setStyle(android.graphics.Paint.Style.FILL);
            var x = 8;
            var y = 7;
            var row = 0;
            var col = 0;
            for (row = 0; row < 3; row++) {
                for (col = 0; col < 2; col++) {
                    canvas.drawCircle(x + col * 8, y + row * 5, 1.2, paint);
                }
            }
            return;
        }
        if (type === "check") {
            path.moveTo(5, 12);
            path.lineTo(10, 17);
            path.lineTo(20, 7);
            canvas.drawPath(path, paint);
            return;
        }
        if (type === "back") {
            path.moveTo(15.5, 5);
            path.lineTo(8.5, 12);
            path.lineTo(15.5, 19);
            canvas.drawPath(path, paint);
            return;
        }
        if (type === "tag") {
            path.moveTo(4, 5);
            path.lineTo(13, 5);
            path.lineTo(21, 13);
            path.lineTo(13, 21);
            path.lineTo(4, 12);
            path.close();
            canvas.drawPath(path, paint);
            canvas.drawCircle(8.5, 9.5, 1.4, paint);
            return;
        }
        if (type === "copy") {
            canvas.drawRoundRect(8, 7, 19, 20, 2, 2, paint);
            canvas.drawRoundRect(5, 4, 16, 17, 2, 2, paint);
            return;
        }
        if (type === "close") {
            canvas.drawLine(6, 6, 18, 18, paint);
            canvas.drawLine(18, 6, 6, 18, paint);
            return;
        }
        if (type === "sort") {
            canvas.drawLine(5, 7, 16, 7, paint);
            canvas.drawLine(5, 12, 13, 12, paint);
            canvas.drawLine(5, 17, 10, 17, paint);
            path.moveTo(18, 5);
            path.lineTo(18, 19);
            path.moveTo(15, 16);
            path.lineTo(18, 19);
            path.lineTo(21, 16);
            canvas.drawPath(path, paint);
            return;
        }

        canvas.drawCircle(12, 12, 8, paint);
    }

    icons.create = function (type, colorValue, sizeDp, filled) {
        var iconType = String(type || "circle");
        var iconColor = Number(colorValue);
        var intrinsicSize = base.dp(sizeDp || 24);
        var alphaValue = 255;
        var colorFilterValue = null;

        var drawableRef = null;
        drawableRef = new JavaAdapter(android.graphics.drawable.Drawable, {
            draw: function (canvas) {
                var bounds = drawableRef.getBounds();
                var width = bounds.width();
                var height = bounds.height();
                if (width <= 0 || height <= 0) return;
                var save = canvas.save();
                canvas.translate(bounds.left, bounds.top);
                canvas.scale(width / 24.0, height / 24.0);
                var paint = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
                paint.setColor(iconColor);
                paint.setAlpha(alphaValue);
                if (colorFilterValue) paint.setColorFilter(colorFilterValue);
                var path = new android.graphics.Path();
                drawIcon(canvas, paint, path, iconType);
                if (filled && iconType === "star") {
                    paint.setStyle(android.graphics.Paint.Style.FILL);
                    path.reset();
                    path.moveTo(12, 3);
                    path.lineTo(14.7, 8.6);
                    path.lineTo(21, 9.5);
                    path.lineTo(16.4, 13.9);
                    path.lineTo(17.5, 20.2);
                    path.lineTo(12, 17.2);
                    path.lineTo(6.5, 20.2);
                    path.lineTo(7.6, 13.9);
                    path.lineTo(3, 9.5);
                    path.lineTo(9.3, 8.6);
                    path.close();
                    canvas.drawPath(path, paint);
                }
                canvas.restoreToCount(save);
            },
            setAlpha: function (alpha) {
                alphaValue = Number(alpha);
                drawableRef.invalidateSelf();
            },
            setColorFilter: function (colorFilter) {
                colorFilterValue = colorFilter;
                drawableRef.invalidateSelf();
            },
            getOpacity: function () {
                return android.graphics.PixelFormat.TRANSLUCENT;
            },
            getIntrinsicWidth: function () {
                return intrinsicSize;
            },
            getIntrinsicHeight: function () {
                return intrinsicSize;
            }
        });
        return drawableRef;
    };

    CH.icons = icons;
}(CH));
