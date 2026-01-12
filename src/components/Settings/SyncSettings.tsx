import { useState, useEffect, useCallback } from "react";
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Check,
  AlertCircle,
  ExternalLink,
  Download,
  Upload,
  Settings,
  Key,
  X,
  FileText,
  FolderSync,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { useSyncStore, useLibraryStore, useStudyGroupStore } from "../../stores";
import { exportSyncData, importSyncData, syncPdfFiles } from "../../services/syncService";

interface SyncSettingsProps {
  onClose: () => void;
}

export function SyncSettings({ onClose }: SyncSettingsProps) {
  const {
    isConnected,
    lastSync,
    syncInProgress,
    error,
    autoSyncEnabled,
    autoSyncInterval,
    connectDropbox,
    handleDropboxCallback,
    syncDropbox,
    disconnectDropbox,
    setAutoSync,
    checkConnection,
  } = useSyncStore();

  const [appKey, setAppKey] = useState("");
  const [showAppKeyInput, setShowAppKeyInput] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [callbackCode, setCallbackCode] = useState("");
  const [showCallbackInput, setShowCallbackInput] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  // PDF sync state
  const [pdfSyncInProgress, setPdfSyncInProgress] = useState(false);
  const [pdfSyncProgress, setPdfSyncProgress] = useState<string>("");
  const [pdfSyncResult, setPdfSyncResult] = useState<{
    uploaded: number;
    downloaded: number;
    errors: number;
  } | null>(null);

  // Get library documents and study groups
  const { documents, addDocument } = useLibraryStore();
  const { studyGroups, getGroupForDocument, createStudyGroup, addDocumentToGroup } = useStudyGroupStore();

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Handle Dropbox connection
  const handleConnect = useCallback(async () => {
    if (!appKey.trim()) {
      alert("Please enter your Dropbox App Key");
      return;
    }

    try {
      const url = await connectDropbox(appKey.trim());
      setAuthUrl(url);
      setShowCallbackInput(true);
      // Open auth URL in browser using Tauri shell
      await open(url);
    } catch (err) {
      console.error("Failed to start auth:", err);
    }
  }, [appKey, connectDropbox]);

  // Handle callback code
  const handleCallbackSubmit = useCallback(async () => {
    if (!callbackCode.trim()) {
      alert("Please enter the authorization code");
      return;
    }

    try {
      await handleDropboxCallback(callbackCode.trim());
      setShowCallbackInput(false);
      setCallbackCode("");
      setAuthUrl(null);
      setShowAppKeyInput(false);
      setAppKey("");
    } catch (err) {
      console.error("Failed to complete auth:", err);
    }
  }, [callbackCode, handleDropboxCallback]);

  // Handle sync
  const handleSync = useCallback(async () => {
    const result = await syncDropbox();
    if (result.success) {
      // Reload page to apply synced data
      if (confirm("동기화 완료! 변경사항을 적용하려면 새로고침이 필요합니다. 새로고침 하시겠습니까?")) {
        window.location.reload();
      }
    }
  }, [syncDropbox]);

  // Helper to find or create study group by name
  const findOrCreateStudyGroup = useCallback((groupName: string): string => {
    const existing = studyGroups.find((g) => g.name === groupName);
    if (existing) {
      return existing.id;
    }
    // Create new study group with a random color
    return createStudyGroup(groupName);
  }, [studyGroups, createStudyGroup]);

  // Handle PDF sync
  const handlePdfSync = useCallback(async () => {
    setPdfSyncInProgress(true);
    setPdfSyncProgress("PDF 파일 준비 중...");
    setPdfSyncResult(null);

    try {
      // Collect local PDFs with their study group names
      const localPdfs = documents.map((doc) => {
        const group = getGroupForDocument(doc.id);
        return {
          path: doc.file_path,
          studyGroupName: group?.name || null,
        };
      });

      // Sync PDFs
      const result = await syncPdfFiles(localPdfs, (message) => {
        setPdfSyncProgress(message);
      });

      // Add downloaded files to library and study groups
      if (result.downloadedInfo && result.downloadedInfo.length > 0) {
        setPdfSyncProgress("라이브러리에 파일 추가 중...");

        for (const downloadedFile of result.downloadedInfo) {
          try {
            // Add to library
            const newDoc = await addDocument(
              downloadedFile.localPath,
              downloadedFile.fileName
            );

            // Add to study group if applicable
            if (newDoc && downloadedFile.studyGroupName) {
              const groupId = findOrCreateStudyGroup(downloadedFile.studyGroupName);
              addDocumentToGroup(groupId, newDoc.id);
            }
          } catch (err) {
            console.error(`Failed to add ${downloadedFile.fileName} to library:`, err);
          }
        }
      }

      setPdfSyncResult({
        uploaded: result.uploaded.length,
        downloaded: result.downloaded.length,
        errors: result.errors.length,
      });

      if (result.downloaded.length > 0) {
        setPdfSyncProgress(`${result.downloaded.length}개 파일 다운로드 및 라이브러리 추가 완료!`);
      } else if (result.uploaded.length > 0) {
        setPdfSyncProgress(`${result.uploaded.length}개 파일 업로드 완료!`);
      } else {
        setPdfSyncProgress("모든 PDF가 동기화되어 있습니다.");
      }
    } catch (err) {
      setPdfSyncProgress(`오류: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    } finally {
      setPdfSyncInProgress(false);
    }
  }, [documents, getGroupForDocument, addDocument, findOrCreateStudyGroup, addDocumentToGroup]);

  // Handle export
  const handleExport = useCallback(() => {
    exportSyncData();
  }, []);

  // Handle import
  const handleImport = useCallback(async () => {
    if (!importFile) return;

    try {
      await importSyncData(importFile);
      alert("데이터를 성공적으로 가져왔습니다. 새로고침이 필요합니다.");
      window.location.reload();
    } catch (err) {
      alert("가져오기 실패: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }, [importFile]);

  // Format last sync time
  const formatLastSync = (time: string | null) => {
    if (!time) return "동기화 안됨";
    const date = new Date(time);
    return date.toLocaleString("ko-KR");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            클라우드 동기화
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">

      {/* Connection Status */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <CloudOff className="w-5 h-5 text-gray-400" />
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {isConnected ? "Dropbox 연결됨" : "연결 안됨"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                마지막 동기화: {formatLastSync(lastSync)}
              </p>
            </div>
          </div>

          {isConnected && (
            <button
              onClick={handleSync}
              disabled={syncInProgress}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncInProgress ? "animate-spin" : ""}`} />
              {syncInProgress ? "동기화 중..." : "지금 동기화"}
            </button>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300 text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Dropbox Connection UI */}
        {!isConnected && (
          <div className="space-y-4">
            {!showAppKeyInput ? (
              <button
                onClick={() => setShowAppKeyInput(true)}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Cloud className="w-5 h-5" />
                Dropbox 연결하기
              </button>
            ) : (
              <div className="space-y-4">
                {/* App Key input */}
                {!showCallbackInput ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Key className="w-4 h-4 inline mr-1" />
                        Dropbox App Key
                      </label>
                      <input
                        type="text"
                        value={appKey}
                        onChange={(e) => setAppKey(e.target.value)}
                        placeholder="App Key 입력..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <a
                          href="https://www.dropbox.com/developers/apps"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          Dropbox 개발자 콘솔에서 앱 생성
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowAppKeyInput(false)}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleConnect}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        연결
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
                      <p className="font-medium mb-1">인증 단계:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>새 창에서 Dropbox 로그인 및 앱 승인</li>
                        <li>승인 후 표시되는 코드를 복사</li>
                        <li>아래에 코드 붙여넣기</li>
                      </ol>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        인증 코드
                      </label>
                      <input
                        type="text"
                        value={callbackCode}
                        onChange={(e) => setCallbackCode(e.target.value)}
                        placeholder="인증 코드 붙여넣기..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowCallbackInput(false);
                          setShowAppKeyInput(false);
                        }}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      >
                        취소
                      </button>
                      {authUrl && (
                        <button
                          onClick={() => open(authUrl)}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1"
                        >
                          <ExternalLink className="w-4 h-4" />
                          다시 열기
                        </button>
                      )}
                      <button
                        onClick={handleCallbackSubmit}
                        disabled={syncInProgress}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {syncInProgress ? "처리 중..." : "완료"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Connected - Disconnect button */}
        {isConnected && (
          <button
            onClick={disconnectDropbox}
            className="text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Dropbox 연결 해제
          </button>
        )}
      </div>

      {/* Auto Sync Settings */}
      {isConnected && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            자동 동기화
          </h4>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              자동 동기화 활성화
            </label>
            {autoSyncEnabled && (
              <select
                value={autoSyncInterval}
                onChange={(e) => setAutoSync(true, Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              >
                <option value={5}>5분마다</option>
                <option value={15}>15분마다</option>
                <option value={30}>30분마다</option>
                <option value={60}>1시간마다</option>
              </select>
            )}
          </div>
        </div>
      )}

      {/* PDF File Sync */}
      {isConnected && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <FolderSync className="w-4 h-4" />
            PDF 파일 동기화
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            PDF 파일을 Dropbox에 업로드하고 다른 기기에서 다운로드합니다.
            스터디 그룹별로 폴더가 생성됩니다.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePdfSync}
              disabled={pdfSyncInProgress || syncInProgress}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              <FileText className={`w-4 h-4 ${pdfSyncInProgress ? "animate-pulse" : ""}`} />
              {pdfSyncInProgress ? "동기화 중..." : "PDF 동기화"}
            </button>
            <span className="text-sm text-gray-500">
              {documents.length}개 PDF 파일
            </span>
          </div>
          {pdfSyncProgress && (
            <div className={`mt-3 p-2 rounded text-sm ${
              pdfSyncResult?.errors ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300" :
              "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
            }`}>
              {pdfSyncProgress}
            </div>
          )}
          {pdfSyncResult && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              업로드: {pdfSyncResult.uploaded} | 다운로드: {pdfSyncResult.downloaded}
              {pdfSyncResult.errors > 0 && ` | 오류: ${pdfSyncResult.errors}`}
            </div>
          )}
        </div>
      )}

      {/* Manual Backup/Restore */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
          수동 백업/복원
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm"
          >
            <Upload className="w-4 h-4" />
            데이터 내보내기
          </button>
          <label className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm cursor-pointer">
            <Download className="w-4 h-4" />
            데이터 가져오기
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setImportFile(file);
                  handleImport();
                }
              }}
            />
          </label>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-200">
        <h4 className="font-medium mb-2">Dropbox 앱 설정 방법:</h4>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            <a
              href="https://www.dropbox.com/developers/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Dropbox 개발자 콘솔
            </a>
            에서 새 앱 생성
          </li>
          <li>"Scoped access" + "App folder" 선택</li>
          <li>앱 이름을 "Marginalia" 또는 원하는 이름으로 설정</li>
          <li>Permissions 탭에서 files.content.read/write 활성화</li>
          <li>Settings에서 App Key 복사</li>
        </ol>
      </div>
        </div>
      </div>
    </div>
  );
}
