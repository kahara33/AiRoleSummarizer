import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import KnowledgeGraphViewer from './KnowledgeGraphViewer';
import { Button } from '@/components/ui/button';
import { 
  Maximize2, 
  Minimize2, 
  ArrowDownUp, 
  ArrowLeftRight,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { KnowledgeNode } from '@shared/schema';
interface EnhancedKnowledgeGraphViewerProps {
  roleModelId: string;
  width?: string | number;
  height?: string | number;
  className?: string;
  onNodeClick?: (nodeId: string) => void;
}

type LayoutDirection = 'TB' | 'LR' | 'RL' | 'BT';

const EnhancedKnowledgeGraphViewer: React.FC<EnhancedKnowledgeGraphViewerProps> = ({
  roleModelId,
  width = '100%',
  height = '600px',
  className,
  onNodeClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('TB');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // レイアウト方向の説明
  const layoutLabels = {
    TB: 'トップダウン',
    LR: '左から右',
    RL: '右から左',
    BT: 'ボトムアップ',
  };

  // フルスクリーン切り替え
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      // フルスクリーンにする
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      // フルスクリーン解除
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  // フルスクリーン変更イベントの監視
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // レイアウト方向変更時の処理
  const handleLayoutChange = (direction: LayoutDirection) => {
    setIsLoading(true);
    setLayoutDirection(direction);
    
    // 短い遅延を加えて、UI更新を反映
    setTimeout(() => {
      setIsLoading(false);
    }, 300);
    
    toast({
      title: 'レイアウト変更',
      description: `レイアウト方向を「${layoutLabels[direction]}」に変更しました`,
    });
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative border rounded-lg overflow-hidden',
        isFullscreen ? 'fixed inset-0 z-50' : '',
        className
      )}
      style={{ 
        width: isFullscreen ? '100vw' : width, 
        height: isFullscreen ? '100vh' : height 
      }}
    >
      {/* 上部コントロールバー */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-sm border-b flex justify-between items-center p-2">
        <div className="font-medium">ナレッジグラフ</div>
        
        <div className="flex items-center gap-2">
          {/* レイアウト方向の選択 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <LayoutGrid className="h-4 w-4 mr-2" />
                {layoutLabels[layoutDirection]}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3">
              <div className="space-y-2">
                <h4 className="font-medium">レイアウト方向</h4>
                <RadioGroup 
                  value={layoutDirection} 
                  onValueChange={(value) => handleLayoutChange(value as LayoutDirection)}
                  className="grid grid-cols-2 gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="TB" id="layout-tb" />
                    <Label htmlFor="layout-tb" className="flex items-center">
                      <ArrowDownUp className="h-4 w-4 mr-1" />
                      トップダウン
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="BT" id="layout-bt" />
                    <Label htmlFor="layout-bt" className="flex items-center">
                      <ArrowDownUp className="h-4 w-4 mr-1 rotate-180" />
                      ボトムアップ
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="LR" id="layout-lr" />
                    <Label htmlFor="layout-lr" className="flex items-center">
                      <ArrowLeftRight className="h-4 w-4 mr-1" />
                      左から右
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="RL" id="layout-rl" />
                    <Label htmlFor="layout-rl" className="flex items-center">
                      <ArrowLeftRight className="h-4 w-4 mr-1 rotate-180" />
                      右から左
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* フルスクリーン切り替え */}
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* メインのグラフビューアー */}
      <div className="h-full pt-10">
        <ReactFlowProvider>
          <KnowledgeGraphViewer
            roleModelId={roleModelId}
            width="100%"
            height="100%"
            onNodeSelect={node => onNodeClick?.(node.id)}
          />
        </ReactFlowProvider>
      </div>

      {/* ローディングオーバーレイ */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-20">
          <div className="flex flex-col items-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
            <div className="text-sm">レイアウト調整中...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedKnowledgeGraphViewer;