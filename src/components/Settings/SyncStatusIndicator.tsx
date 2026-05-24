import { Cloud, CloudOff, RefreshCw, AlertCircle, Check } from "lucide-react";
import { useSyncStore } from "../../stores/syncStore";

export function SyncStatusIndicator() {
  const {
    isConnected,
    syncInProgress,
    lastSync,
    error,
    autoSyncEnabled,
    syncDropbox,
  } = useSyncStore();

  const formatLastSync = (isoString: string | null): string => {
    if (!isoString) return "동기화 안 됨";

    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "방금";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    return date.toLocaleDateString("ko-KR");
  };

  const handleManualSync = async () => {
    if (!isConnected || syncInProgress) return;
    await syncDropbox();
  };

  if (!isConnected) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 text-gray-400 dark:text-gray-500">
        <CloudOff className="w-4 h-4" />
        <span className="text-xs hidden sm:inline">오프라인</span>
      </div>
    );
  }

  if (error) {
    return (
      <button
        onClick={handleManualSync}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
        title={`동기화 오류: ${error}. 클릭하여 재시도.`}
      >
        <AlertCircle className="w-4 h-4" />
        <span className="text-xs hidden sm:inline">오류</span>
      </button>
    );
  }

  if (syncInProgress) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 text-blue-500">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-xs hidden sm:inline">동기화 중...</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleManualSync}
      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-green-500"
      title={`마지막 동기화: ${formatLastSync(lastSync)}${autoSyncEnabled ? " (자동 동기화 활성화)" : ""}. 클릭하여 지금 동기화.`}
    >
      {lastSync ? (
        <Check className="w-4 h-4" />
      ) : (
        <Cloud className="w-4 h-4" />
      )}
      <span className="text-xs hidden sm:inline">
        {formatLastSync(lastSync)}
      </span>
      {autoSyncEnabled && (
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      )}
    </button>
  );
}
