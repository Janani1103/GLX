import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const settingsApi = {
    get: async () => (await api.get('/settings')).data,
    update: async (data) => (await api.put('/settings', data)).data,
};

export const useSettings = () => useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
});

export const useUpdateSettings = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: settingsApi.update,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['settings'] });
            toast.success('System settings updated');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to update settings'),
    });
};
