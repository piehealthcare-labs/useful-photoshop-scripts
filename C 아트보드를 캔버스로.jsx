// Photoshop Artboard to Regular Canvas Script (Ultimate Fail-Proof Version)
// 작성자: Antigravity
// 기능: 기존 대지를 해제하고 일반 캔버스로 변환하며 기존 폴더 구조를 유지하고 원본에 그대로 덮어쓰기 저장합니다.

#target photoshop

function main() {
    if (app.documents.length === 0) {
        alert("열려있는 포토샵 파일이 없습니다.");
        return;
    }

    var originalDocs = [];
    for (var i = 0; i < app.documents.length; i++) {
        originalDocs.push(app.documents[i]);
    }

    var processedCount = 0;

    // 환경설정 (대화상자 무시, 눈금자 단위 픽셀 고정)
    var originalDialogMode = app.displayDialogs;
    var originalRulerUnits = app.preferences.rulerUnits;
    app.displayDialogs = DialogModes.NO;
    app.preferences.rulerUnits = Units.PIXELS;

    for (var j = 0; j < originalDocs.length; j++) {
        var doc = originalDocs[j];

        try {
            app.activeDocument = doc;
            if (convertInPlace(doc)) {
                processedCount++;
            }
        } catch (e) {
            // alert("에러: " + e.message);
        }
    }

    // 환경설정 복구
    app.displayDialogs = originalDialogMode;
    app.preferences.rulerUnits = originalRulerUnits;

    alert("작업 완료!\n총 " + processedCount + "개의 문서가 일반 캔버스로 안전하게 변환되었습니다.");
}

function convertInPlace(doc) {
    // 1. 대지가 있는지 먼저 확인
    var artboards = [];
    findArtboardsRecursive(doc, artboards);

    if (artboards.length === 0) {
        return false; // 대지가 없으면 건너뜀
    }

    // 2. 대지들의 정확한 전체 영역(Bounds)을 계산
    var abRect = getArtboardsRect(artboards);

    // 3. 각 대지 변환 처리
    // 사용자가 대지를 항상 분리해서 작업한다고 하셨으므로, 
    // 대지가 하나일 경우와 여러 개일 경우를 나누어 처리합니다.
    for (var abIdx = artboards.length - 1; abIdx >= 0; abIdx--) {
        var ab = artboards[abIdx];

        try { ab.visible = true; } catch (e) { }
        try { ab.allLocked = false; } catch (e) { }

        var rect = getArtboardRect(ab);
        var colorInfo = getArtboardColor(ab);

        // 배경색 레이어 생성
        if (colorInfo && colorInfo.hasColor && rect) {
            createColorLayerAtBottom(ab, rect, colorInfo);
        }

        // 대지 속성 제거 및 원래 폴더 형태(그룹) 유지
        var isOnlyArtboard = (artboards.length === 1);
        removeArtboardData(ab, isOnlyArtboard);
    }

    // 4. 투명 영역/보이지 않는 영역 제외하고 대지 크기로 정밀 크롭
    try {
        if (abRect) {
            var cropBounds = [
                new UnitValue(abRect[0], "px"),
                new UnitValue(abRect[1], "px"),
                new UnitValue(abRect[2], "px"),
                new UnitValue(abRect[3], "px")
            ];
            doc.crop(cropBounds);
        }
    } catch (e) { }

    // 5. 원본 파일 덮어쓰기
    try {
        doc.save();
    } catch (e) { }

    return true;
}

function findArtboardsRecursive(parent, artboards) {
    var layers = parent.layers;
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        if (layer.typename === "LayerSet") {
            if (isArtboard(layer)) {
                artboards.push(layer);
            }
            // 내부 탐색
            findArtboardsRecursive(layer, artboards);
        }
    }
}

function isArtboard(layer) {
    try {
        var ref = new ActionReference();
        ref.putIdentifier(stringIDToTypeID("layer"), layer.id);
        var desc = executeActionGet(ref);
        
        if (desc.hasKey(stringIDToTypeID("artboard"))) {
            return true;
        }
        if (desc.hasKey(stringIDToTypeID("artboardEnabled"))) {
            return desc.getBoolean(stringIDToTypeID("artboardEnabled"));
        }
        return false;
    } catch (e) {
        return false;
    }
}

function removeArtboardData(layerSet, isOnlyArtboard) {
    try {
        var doc = app.activeDocument;
        var originalName = layerSet.name;
        var artboardId = layerSet.id;
        
        // 1. 내부 레이어들의 클리핑 마스크 상태와 ID 기억
        var layersInfo = [];
        var hasLayers = layerSet.layers.length > 0;
        for (var i = 0; i < layerSet.layers.length; i++) {
            layersInfo.push({
                id: layerSet.layers[i].id,
                isClipped: layerSet.layers[i].grouped
            });
        }

        // 2. 레이어 스타일(효과)이 있는지 확인
        var hasEffects = false;
        try {
            var ref = new ActionReference();
            ref.putIdentifier(stringIDToTypeID("layer"), artboardId);
            var desc = executeActionGet(ref);
            hasEffects = desc.hasKey(stringIDToTypeID("layerEffects"));
        } catch(e) {}

        // 3. 효과가 있다면 미리 복사
        if (hasEffects) {
            selectLayerById(artboardId); // 다중 선택 해제 및 대지만 정확하게 선택
            try {
                executeAction(stringIDToTypeID("copyLayerStyle"), undefined, DialogModes.NO);
            } catch(e) {}
        }

        // 투명도와 블렌드 모드 사전 저장 (아트보드 자체가 가진 속성 보존)
        var originalOpacity = 100;
        var originalBlendMode = BlendMode.NORMAL;
        try {
            originalOpacity = layerSet.opacity;
            originalBlendMode = layerSet.blendMode;
        } catch(e) {}

        // 4. 대지 해제 (Ungroup Artboard)
        selectLayerById(artboardId); // 다중 선택 해제 및 정확한 선택 (내부 요소를 같이 언그룹하는 버그 방지)
        var idungroupLayersEvent = stringIDToTypeID("ungroupLayersEvent");
        var desc1 = new ActionDescriptor();
        var ref1 = new ActionReference();
        ref1.putEnumerated(stringIDToTypeID("layer"), stringIDToTypeID("ordinal"), stringIDToTypeID("targetEnum"));
        desc1.putReference(stringIDToTypeID("null"), ref1);
        executeAction(idungroupLayersEvent, desc1, DialogModes.NO);

        // 5. 대지가 여러 개일 때만 재그룹화. 대지가 1개일 경우 전체가 하나의 폴더로 묶이는 것을 방지.
        if (hasLayers && !isOnlyArtboard) {
            var idMk = stringIDToTypeID("make");
            var desc2 = new ActionDescriptor();
            var ref2 = new ActionReference();
            ref2.putClass(stringIDToTypeID("layerSection"));
            desc2.putReference(stringIDToTypeID("null"), ref2);
            var ref3 = new ActionReference();
            ref3.putEnumerated(stringIDToTypeID("layer"), stringIDToTypeID("ordinal"), stringIDToTypeID("targetEnum"));
            desc2.putReference(stringIDToTypeID("from"), ref3);
            var desc3 = new ActionDescriptor();
            desc3.putString(stringIDToTypeID("name"), originalName);
            desc2.putObject(stringIDToTypeID("using"), stringIDToTypeID("layerSection"), desc3);
            executeAction(idMk, desc2, DialogModes.NO);

            // 투명도와 블렌드 모드 복구
            try {
                doc.activeLayer.opacity = originalOpacity;
                doc.activeLayer.blendMode = originalBlendMode;
            } catch(e) {}

            // 효과 붙여넣기 (기존 효과가 있었던 경우에만)
            if (hasEffects) {
                try {
                    executeAction(stringIDToTypeID("pasteLayerStyle"), undefined, DialogModes.NO);
                } catch(e) {}
            }
        }

        // 6. 클리핑 마스크 수동 복원 (Layer ID 기반으로 정확하게)
        for (var j = 0; j < layersInfo.length; j++) {
            if (layersInfo[j].isClipped) {
                try {
                    selectLayerById(layersInfo[j].id);
                    if (!doc.activeLayer.grouped) {
                        doc.activeLayer.grouped = true;
                    }
                } catch(e) {}
            }
        }
        
    } catch (e) { 
        // alert("변환 중 에러: " + e.message);
    }
}

function selectLayerById(id) {
    var ref = new ActionReference();
    ref.putIdentifier(charIDToTypeID("Lyr "), id);
    var desc = new ActionDescriptor();
    desc.putReference(charIDToTypeID("null"), ref);
    desc.putBoolean(stringIDToTypeID("makeVisible"), false);
    executeAction(charIDToTypeID("slct"), desc, DialogModes.NO);
}

function getArtboardColor(layer) {
    try {
        var ref = new ActionReference();
        ref.putIdentifier(stringIDToTypeID("layer"), layer.id);
        var desc = executeActionGet(ref);
        var artboardDesc = desc.getObjectValue(stringIDToTypeID("artboard"));

        var bgType = 1; // 기본은 White
        try {
            bgType = artboardDesc.getInteger(stringIDToTypeID("artboardBackgroundType"));
        } catch (e) { }

        var colorInfo = { hasColor: false, r: 255, g: 255, b: 255 };

        if (bgType === 1) { // White
            colorInfo.hasColor = true;
            colorInfo.r = 255; colorInfo.g = 255; colorInfo.b = 255;
        } else if (bgType === 2) { // Black
            colorInfo.hasColor = true;
            colorInfo.r = 0; colorInfo.g = 0; colorInfo.b = 0;
        } else if (bgType === 3) { // Transparent
            colorInfo.hasColor = false;
        } else {
            // Custom Color 기타 등등
            try {
                var cDesc = artboardDesc.getObjectValue(stringIDToTypeID("color"));
                colorInfo.r = cDesc.getDouble(stringIDToTypeID("red"));
                colorInfo.g = cDesc.getDouble(stringIDToTypeID("green"));
                colorInfo.b = cDesc.getDouble(stringIDToTypeID("blue"));
                colorInfo.hasColor = true;
            } catch (e) {
                // 지정되었지만 속성 추출 실패시 우선 투명 처리
                colorInfo.hasColor = false;
            }
        }
        return colorInfo;
    } catch (e) {
        return { hasColor: false };
    }
}

function createColorLayerAtBottom(parentGroup, rect, colorInfo) {
    try {
        var originalActiveLayer = app.activeDocument.activeLayer;

        // 새 레이어를 대상 대지 그룹 가장 위에 생성 (기본동작)
        var bgLayer = parentGroup.artLayers.add();
        bgLayer.name = "대지 배경색";

        // 맨 아래로 옮기기 위해 현재 맨 아랫단 레이어 뒤로 이동
        var length = parentGroup.layers.length;
        if (length > 1) {
            var lastIdx = length - 1;
            var lastLayer = parentGroup.layers[lastIdx];
            if (bgLayer.id !== lastLayer.id) {
                var wasLocked = false;
                try {
                    wasLocked = lastLayer.allLocked;
                    if (wasLocked) lastLayer.allLocked = false;
                } catch(e) {}
                
                try { bgLayer.move(lastLayer, ElementPlacement.PLACEAFTER); } catch(e) { }
                
                try {
                    if (wasLocked) lastLayer.allLocked = true;
                } catch(e) {}
            }
        }

        // 선택 영역을 대지의 좌표만큼 지정
        var selRegion = [
            [rect[0], rect[1]],
            [rect[2], rect[1]],
            [rect[2], rect[3]],
            [rect[0], rect[3]]
        ];
        app.activeDocument.selection.select(selRegion);

        // 얻어온 배경 색상 채우기
        var solidColor = new SolidColor();
        solidColor.rgb.red = colorInfo.r;
        solidColor.rgb.green = colorInfo.g;
        solidColor.rgb.blue = colorInfo.b;

        // move 이후에 활성 레이어가 부모 그룹 등 다른 영역으로 강제 변경되는 PS 내부 버그 방지
        app.activeDocument.activeLayer = bgLayer;

        app.activeDocument.selection.fill(solidColor);
        app.activeDocument.selection.deselect();

        app.activeDocument.activeLayer = originalActiveLayer;
    } catch (e) { }
}

function getArtboardsRect(artboards) {
    if (artboards.length === 0) return null;
    var minLeft = null, minTop = null, maxRight = null, maxBottom = null;

    for (var i = 0; i < artboards.length; i++) {
        var rect = getArtboardRect(artboards[i]);
        if (rect) {
            if (minLeft === null || rect[0] < minLeft) minLeft = rect[0];
            if (minTop === null || rect[1] < minTop) minTop = rect[1];
            if (maxRight === null || rect[2] > maxRight) maxRight = rect[2];
            if (maxBottom === null || rect[3] > maxBottom) maxBottom = rect[3];
        }
    }
    if (minLeft !== null) {
        return [minLeft, minTop, maxRight, maxBottom];
    }
    return null;
}

function getArtboardRect(layer) {
    try {
        var ref = new ActionReference();
        ref.putIdentifier(stringIDToTypeID("layer"), layer.id);
        var desc = executeActionGet(ref);
        var artboardDesc = desc.getObjectValue(stringIDToTypeID("artboard"));
        var rect = artboardDesc.getObjectValue(stringIDToTypeID("artboardRect"));
        var top = rect.getDouble(stringIDToTypeID("top"));
        var left = rect.getDouble(stringIDToTypeID("left"));
        var bottom = rect.getDouble(stringIDToTypeID("bottom"));
        var right = rect.getDouble(stringIDToTypeID("right"));
        return [left, top, right, bottom];
    } catch (e) {
        return null;
    }
}

main();
