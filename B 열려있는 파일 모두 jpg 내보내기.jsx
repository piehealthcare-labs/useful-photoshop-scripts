#target photoshop
app.displayDialogs = DialogModes.NO;

// 룰러 단위를 픽셀로 고정
var originalRulerUnits = app.preferences.rulerUnits;
app.preferences.rulerUnits = Units.PIXELS;

try {
    if (app.documents.length === 0) {
        alert("열려 있는 문서가 없습니다.");
    } else {
        var successCount = 0;
        var docs = app.documents; // 열린 문서 리스트

        // 문서를 하나씩 순회
        for (var i = 0; i < docs.length; i++) {
            var doc = docs[i];

            // 저장되지 않은 파일은 경로를 알 수 없어 패스
            if (!doc.saved || !doc.fullName) {
                continue; 
            }

            app.activeDocument = doc;

            // 1. 작업을 위해 문서를 복제 (원본 보호)
            // "merged"라는 이름으로 임시 복제
            var tempDoc = doc.duplicate("merged"); 

            try {
                // 2. [필수] 아트보드 및 레이어 병합 (Flatten)
                // 이 과정이 있어야 아트보드 크기에 딱 맞춰서 잘립니다.
                tempDoc.flatten();

                // 3. [안전장치] JPG 저장을 위해 RGB 모드 & 8비트로 변환
                // (CMYK나 16비트 이미지는 간혹 JPG 저장 시 옵션창이 뜨거나 에러가 날 수 있음)
                if (tempDoc.mode != DocumentMode.RGB) {
                    tempDoc.changeMode(ChangeMode.RGB);
                }
                if (tempDoc.bitsPerChannel != BitsPerChannelType.EIGHT) {
                    tempDoc.bitsPerChannel = BitsPerChannelType.EIGHT;
                }

                // 4. 파일명 및 경로 설정
                var docPath = doc.path;
                var docName = doc.name.replace(/\.[^\.]+$/, ""); // 확장자 제거
                var saveFile = new File(docPath + "/" + docName + ".jpg");

                // 5. JPG 저장 옵션 설정
                var jpgOptions = new JPEGSaveOptions();
                jpgOptions.quality = 10; // 0~12 사이 값 (SaveForWeb의 80%는 여기서 약 10 정도)
                jpgOptions.embedColorProfile = false; // 프로파일 포함 여부
                jpgOptions.formatOptions = FormatOptions.STANDARDBASELINE;
                jpgOptions.matte = MatteType.NONE;

                // 6. 저장 실행
                tempDoc.saveAs(saveFile, jpgOptions, true, Extension.LOWERCASE);
                
                successCount++;

            } catch (err) {
                // 개별 파일 에러 시 무시하고 진행하거나 로그 확인 가능
                // alert(doc.name + " 저장 중 오류: " + err.message);
            } finally {
                // 7. 복제된 임시 문서는 저장하지 않고 닫기
                tempDoc.close(SaveOptions.DONOTSAVECHANGES);
            }
        }

        alert("작업 완료! 총 " + successCount + "개의 문서를 JPG로 저장했습니다.");
    }
} catch (e) {
    alert("스크립트 실행 중 치명적 오류 발생: " + e);
} finally {
    // 설정 원복
    app.preferences.rulerUnits = originalRulerUnits;
}