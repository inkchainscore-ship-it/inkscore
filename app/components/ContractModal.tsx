import { useState, useEffect } from 'react';
import { ContractWithPlatforms, Platform } from '@/lib/types/platforms';
import { getProxiedImageUrl } from '@/lib/utils/imageProxy';

interface ContractModalProps {
  contract?: ContractWithPlatforms;
  platforms: Platform[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

export default function ContractModal({ contract, platforms, onSave, onClose, saving }: ContractModalProps) {
  const [formData, setFormData] = useState({
    platform_id: 0,
    address: '',
    name: '',
    deploy_block: 0,
    fetch_transactions: true, // Default to true for new hybrid strategy
    indexing_enabled: true,
    contract_type: 'count' as 'count' | 'volume',
    creation_date: '',
  });

  const [estimatedTransactions, setEstimatedTransactions] = useState<number | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  useEffect(() => {
    if (contract) {
      setFormData({
        platform_id: contract.platforms?.[0]?.id || 0,
        address: contract.address,
        name: contract.name,
        deploy_block: contract.deploy_block,
        fetch_transactions: contract.fetch_transactions,
        indexing_enabled: contract.indexing_enabled,
        contract_type: contract.contract_type || 'count',
        creation_date: contract.creation_date ? contract.creation_date.split('T')[0] : '',
      });
    }
  }, [contract]);

  // Estimate transaction count when address changes
  useEffect(() => {
    if (formData.address && formData.address.startsWith('0x') && formData.address.length === 42) {
      estimateTransactionCount();
    }
  }, [formData.address]);

  const estimateTransactionCount = async () => {
    setLoadingEstimate(true);
    try {
      const response = await fetch(`/api/contracts/estimate-transactions?address=${formData.address}`);
      const data = await response.json();
      setEstimatedTransactions(data.count || 0);
    } catch (error) {
      console.error('Failed to estimate transactions:', error);
      setEstimatedTransactions(null);
    } finally {
      setLoadingEstimate(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate creation date for new contracts
    if (!contract && !formData.creation_date) {
      alert('Creation date is required for new contracts');
      return;
    }

    await onSave(formData);
  };

  const getEstimatedBackfillTime = () => {
    if (!estimatedTransactions) return null;
    
    // Based on benchmark: 500K transactions in ~87 seconds
    const batchSize = 500000;
    const timePerBatch = 87; // seconds
    const batches = Math.ceil(estimatedTransactions / batchSize);
    const totalSeconds = batches * timePerBatch;
    
    if (totalSeconds < 60) return `~${totalSeconds} seconds`;
    if (totalSeconds < 3600) return `~${Math.ceil(totalSeconds / 60)} minutes`;
    return `~${Math.ceil(totalSeconds / 3600)} hours`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">
          {contract ? 'Edit Contract' : 'Add New Contract'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Platform</label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {platforms.map((platform) => (
                <label key={platform.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="platform"
                    value={platform.id}
                    checked={formData.platform_id === platform.id}
                    onChange={(e) => setFormData({ ...formData, platform_id: parseInt(e.target.value) })}
                    className="rounded bg-slate-700 border-slate-600"
                  />
                  <div className="flex items-center gap-2">
                    {platform.logo_url && (
                      <img src={getProxiedImageUrl(platform.logo_url)} alt="" className="w-5 h-5 rounded" />
                    )}
                    <span>{platform.name}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Contract Address */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Contract Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
              placeholder="0x..."
              required
              disabled={!!contract}
            />
            {loadingEstimate && (
              <p className="text-sm text-slate-400 mt-1">Estimating transaction count...</p>
            )}
            {estimatedTransactions !== null && (
              <p className="text-sm text-slate-400 mt-1">
                ~{estimatedTransactions.toLocaleString()} transactions found
                {getEstimatedBackfillTime() && (
                  <span className="text-slate-500"> • Backfill time: {getEstimatedBackfillTime()}</span>
                )}
              </p>
            )}
          </div>

          {/* Contract Name */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Velodrome Router"
              required
            />
          </div>

          {/* Creation Date */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Contract Creation Date
              <span className="text-red-400 ml-1">*</span>
            </label>
            <input
              type="date"
              value={formData.creation_date}
              onChange={(e) => setFormData({ ...formData, creation_date: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              required={!contract}
            />
            <p className="text-xs text-slate-500 mt-1">
              Used as the start date for historical data backfill
            </p>
          </div>

          {/* Deploy Block */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Deploy Block</label>
            <input
              type="number"
              value={formData.deploy_block}
              onChange={(e) => setFormData({ ...formData, deploy_block: parseInt(e.target.value) || 0 })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="0"
              required
            />
          </div>

          {/* Contract Type */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Contract Type</label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="contract_type"
                  value="count"
                  checked={formData.contract_type === 'count'}
                  onChange={(e) => setFormData({ ...formData, contract_type: e.target.value as 'count' | 'volume' })}
                  className="rounded bg-slate-700 border-slate-600 mt-1"
                />
                <div>
                  <span className="text-white font-medium">Count Contract</span>
                  <p className="text-sm text-slate-400">
                    Simple transaction counting. Fast indexing, basic metrics.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="contract_type"
                  value="volume"
                  checked={formData.contract_type === 'volume'}
                  onChange={(e) => setFormData({ ...formData, contract_type: e.target.value as 'count' | 'volume' })}
                  className="rounded bg-slate-700 border-slate-600 mt-1"
                />
                <div>
                  <span className="text-white font-medium">Volume Contract</span>
                  <p className="text-sm text-slate-400">
                    Full transaction enrichment with USD values, token amounts, and detailed metrics.
                    <span className="text-yellow-400 block">Takes longer to process but provides comprehensive data.</span>
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.fetch_transactions}
                onChange={(e) => setFormData({ ...formData, fetch_transactions: e.target.checked })}
                className="rounded bg-slate-700 border-slate-600"
              />
              <div>
                <span className="text-sm text-slate-400">Fetch transactions</span>
                <p className="text-xs text-slate-500">Uses hybrid indexing strategy (recommended)</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.indexing_enabled}
                onChange={(e) => setFormData({ ...formData, indexing_enabled: e.target.checked })}
                className="rounded bg-slate-700 border-slate-600"
              />
              <span className="text-sm text-slate-400">Enable indexing</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : contract ? 'Update' : 'Create & Start Backfill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}