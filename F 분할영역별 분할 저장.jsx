#target photoshop
app.displayDialogs = DialogModes.NO;

var OUTPUT_FOLDER_NAME = "\uBD84\uD560\uC601\uC5ED_\uCD9C\uB825";
var DUPLICATE_PREFIX = "\uBD84\uD560_";
var ALERT_NO_DOC = "\uC5F4\uB824 \uC788\uB294 \uBB38\uC11C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.";
var ALERT_NO_SPLIT = "\uBD84\uD560\uC601\uC5ED(\uC2AC\uB77C\uC774\uC2A4/\uAC00\uC774\uB4DC)\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uBA3C\uC800 \uBD84\uD560\uC601\uC5ED\uC744 \uC9C0\uC815\uD574 \uC8FC\uC138\uC694.";
var ALERT_DONE = "\uCD1D {0}\uAC1C\uC758 \uBD84\uD560 \uD30C\uC77C\uC774 \uC800\uC7A5\uB410\uC2B5\uB2C8\uB2E4.\n\uC800\uC7A5 \uC704\uCE58: {1}";
var ALERT_ERROR = "\uC2A4\uD06C\uB9BD\uD2B8 \uC2E4\uD589 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.\n{0}";

function toPxNumber(value) {
    if (value === undefined || value === null) {
        return 0;
    }

    if (typeof value === "number") {
        return value;
    }

    if (value.value !== undefined) {
        try {
            return Number(value.as("px"));
        } catch (e) {
            try {
                return Number(value.value);
            } catch (err) {
                return 0;
            }
        }
    }

    return Number(value);
}

function toPxValue(value) {
    return new UnitValue(toPxNumber(value), "px");
}

function getSliceBounds(slice) {
    if (!slice) {
        return null;
    }

    try {
        var bounds = slice.bounds;
        if (bounds) {
            if (bounds.length >= 4) {
                return {
                    left: toPxNumber(bounds[0]),
                    top: toPxNumber(bounds[1]),
                    right: toPxNumber(bounds[2]),
                    bottom: toPxNumber(bounds[3])
                };
            }

            if (bounds.left !== undefined && bounds.top !== undefined && bounds.right !== undefined && bounds.bottom !== undefined) {
                return {
                    left: toPxNumber(bounds.left),
                    top: toPxNumber(bounds.top),
                    right: toPxNumber(bounds.right),
                    bottom: toPxNumber(bounds.bottom)
                };
            }
        }
    } catch (e) {
        return null;
    }

    if (slice.left !== undefined && slice.top !== undefined && slice.right !== undefined && slice.bottom !== undefined) {
        return {
            left: toPxNumber(slice.left),
            top: toPxNumber(slice.top),
            right: toPxNumber(slice.right),
            bottom: toPxNumber(slice.bottom)
        };
    }

    return null;
}

function addRect(rects, rect) {
    if (!rect) {
        return;
    }

    var left = Math.round(toPxNumber(rect.left));
    var top = Math.round(toPxNumber(rect.top));
    var right = Math.round(toPxNumber(rect.right));
    var bottom = Math.round(toPxNumber(rect.bottom));

    if (right <= left || bottom <= top) {
        return;
    }

    var key = left + "," + top + "," + right + "," + bottom;
    for (var i = 0; i < rects.length; i++) {
        if (rects[i].key === key) {
            return;
        }
    }

    rects.push({
        left: left,
        top: top,
        right: right,
        bottom: bottom,
        key: key
    });
}

function collectSplitRects(doc) {
    var rects = [];

    if (doc.slices && doc.slices.length > 0) {
        for (var i = 0; i < doc.slices.length; i++) {
            addRect(rects, getSliceBounds(doc.slices[i]));
        }
    }

    if (rects.length === 0) {
        var guides = doc.guides;
        if (guides && guides.length > 0) {
            var vertical = [];
            var horizontal = [];

            for (var g = 0; g < guides.length; g++) {
                var guide = guides[g];
                if (!guide) {
                    continue;
                }

                var dir = guide.direction;
                if (dir === Direction.VERTICAL || dir === "vertical" || dir === "VERTICAL") {
                    vertical.push(toPxNumber(guide.coordinate));
                } else if (dir === Direction.HORIZONTAL || dir === "horizontal" || dir === "HORIZONTAL") {
                    horizontal.push(toPxNumber(guide.coordinate));
                }
            }

            vertical.sort(function (a, b) { return a - b; });
            horizontal.sort(function (a, b) { return a - b; });

            if (vertical.length > 0 && horizontal.length > 0) {
                var left = 0;
                for (var vx = 0; vx < vertical.length; vx++) {
                    var x = vertical[vx];
                    var top = 0;
                    for (var hy = 0; hy < horizontal.length; hy++) {
                        var y = horizontal[hy];
                        addRect(rects, { left: left, top: top, right: x, bottom: y });
                        top = y;
                    }
                    addRect(rects, { left: left, top: top, right: x, bottom: toPxNumber(doc.height) });
                    left = x;
                }

                var top = 0;
                for (var hy = 0; hy < horizontal.length; hy++) {
                    var y = horizontal[hy];
                    addRect(rects, { left: left, top: top, right: toPxNumber(doc.width), bottom: y });
                    top = y;
                }
                addRect(rects, { left: left, top: top, right: toPxNumber(doc.width), bottom: toPxNumber(doc.height) });
            } else if (vertical.length > 0) {
                var startX = 0;
                for (var vx2 = 0; vx2 < vertical.length; vx2++) {
                    var x2 = vertical[vx2];
                    addRect(rects, { left: startX, top: 0, right: x2, bottom: toPxNumber(doc.height) });
                    startX = x2;
                }
                addRect(rects, { left: startX, top: 0, right: toPxNumber(doc.width), bottom: toPxNumber(doc.height) });
            } else if (horizontal.length > 0) {
                var startY = 0;
                for (var hy2 = 0; hy2 < horizontal.length; hy2++) {
                    var y2 = horizontal[hy2];
                    addRect(rects, { left: 0, top: startY, right: toPxNumber(doc.width), bottom: y2 });
                    startY = y2;
                }
                addRect(rects, { left: 0, top: startY, right: toPxNumber(doc.width), bottom: toPxNumber(doc.height) });
            }
        }
    }

    if (rects.length === 0) {
        addRect(rects, { left: 0, top: 0, right: toPxNumber(doc.width), bottom: toPxNumber(doc.height) });
    }

    return rects;
}

function getPathString(pathObj) {
    try {
        if (pathObj && pathObj.fsName !== undefined) {
            return pathObj.fsName;
        }
    } catch (e) {
    }

    try {
        if (pathObj) {
            return pathObj.toString();
        }
    } catch (e) {
    }

    return "";
}

function pad2(value) {
    return (value < 10) ? "0" + value : String(value);
}

function getBaseName(name) {
    if (!name) {
        return "분할";
    }

    var dotIndex = name.lastIndexOf(".");
    if (dotIndex > 0) {
        name = name.substring(0, dotIndex);
    }
    return name.replace(/[^a-zA-Z0-9가-힣._-]/g, "_");
}

function saveSplitDocument(sourceDoc, rect, index, outputFolder) {
    var baseName = getBaseName(sourceDoc.name);
    var dupName = baseName + "_" + pad2(index + 1);
    var dupDoc = sourceDoc.duplicate(dupName);

    try {
        dupDoc.crop([
            toPxValue(rect.left),
            toPxValue(rect.top),
            toPxValue(rect.right),
            toPxValue(rect.bottom)
        ]);
    } catch (e) {
        dupDoc.close(SaveOptions.DONOTSAVECHANGES);
        throw e;
    }

    var safeName = dupName.replace(/[^a-zA-Z0-9가-힣._-]/g, "_");
    var saveFile = new File(getPathString(outputFolder) + "/" + safeName + ".psd");
    var saveOptions = new PhotoshopSaveOptions();
    saveOptions.layers = true;
    dupDoc.saveAs(saveFile, saveOptions, true);
    dupDoc.close(SaveOptions.DONOTSAVECHANGES);
}

if (app.documents.length === 0) {
    alert(ALERT_NO_DOC);
} else {
    try {
        var doc = app.activeDocument;
        var rects = collectSplitRects(doc);

        if (rects.length === 0) {
            alert(ALERT_NO_SPLIT);
        } else {
            var basePath = (doc.path && doc.path.exists) ? getPathString(doc.path) : getPathString(Folder.desktop);
            var outputFolder = new Folder(basePath + "/" + OUTPUT_FOLDER_NAME);
            if (!outputFolder.exists) {
                outputFolder.create();
            }

            for (var i = 0; i < rects.length; i++) {
                saveSplitDocument(doc, rects[i], i, outputFolder);
            }

            alert(ALERT_DONE.replace("{0}", rects.length).replace("{1}", getPathString(outputFolder)));
        }
    } catch (e) {
        alert(ALERT_ERROR.replace("{0}", e.toString()));
    }
}
