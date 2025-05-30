import React, { useEffect, useState } from 'react';
import {
  Tabs,
  Tab,
  Box,
  Typography,
  Select,
  MenuItem,
  CircularProgress,
  Container,
  useTheme,
} from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchAllUsersWithRole,
  selectAllUsers,
  selectUserLoading,
  updateUserRole,
  updateUserStatus,
} from '../../slices/usersSlice';
import { useAuth } from '../../hooks/useAuth';
import { StyledDataGrid } from '../CustomComponents/StyledDataGrid';
import { useSearchParams } from 'react-router-dom';
import { useTranslatedSnackbar } from '../CustomComponents/TranslatedSnackbar/TranslatedSnackbar';
import { useTranslation } from 'react-i18next';

const STATUS_OPTIONS = [
  'pending',
  'approved',
  'rejected',
  'deactivated',
  'active',
] as const;
const STATUS_LABELS: Record<(typeof STATUS_OPTIONS)[number], string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  deactivated: 'Deactivated',
  active: 'Active',
};
const VALID_FILTERS = ['ALL', 'PENDING', 'ACTIVE', 'DEACTIVED'];
type VALID_FILTER = (typeof VALID_FILTERS)[number];

const ManageUsers: React.FC = () => {
  const dispatch = useAppDispatch();
  const users = useAppSelector(selectAllUsers);
  const loading = useAppSelector(selectUserLoading);
  const { role } = useAuth();
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<VALID_FILTER>('ALL');
  const { t } = useTranslation();
  const { showSnackbar } = useTranslatedSnackbar();

  // Fetch all users with role on component mount
  useEffect(() => {
    dispatch(fetchAllUsersWithRole());
    const param = searchParams.get('filter');
    if (param && VALID_FILTERS.includes(param.toUpperCase()))
      setFilter(param.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ---------------------  Handlers  --------------------------------------------------------------

  const handleTabChange = (
    _: React.SyntheticEvent,
    value: 'ALL' | 'PENDING' | 'ACTIVE' | 'DEACTIVATED',
  ) => {
    setFilter(value);
  };

  // Handle role change
  const handleRoleChange = async (
    userId: string,
    role: 'User' | 'Admin' | 'Head Admin',
  ) => {
    let changedUser = users.find((u) => u.user_id === userId);
    try {
      await dispatch(updateUserRole({ userId, role })).unwrap();
      // Find the user by ID to get their display name
      changedUser = users.find((u) => u.user_id === userId);
      const name = changedUser?.display_name ?? 'User';
      showSnackbar({
        message: t('manageUsers', {
          name: name,
          role: t(`admin.dashboard.roles.${role}`),
        }),
        variant: 'info',
      });
      // Refresh the grid data without reloading the page
    } catch (err: unknown) {
      // Handle error
      if (err instanceof Error) {
        console.error('Error updating user role:', err.message);
        showSnackbar({
          message: t('manageUsers.roleUpdateFailed', {
            error: err.message,
            target: changedUser?.display_name ?? 'User',
            defaultValue: `${changedUser?.display_name ?? 'User'}: ${err.message
              }`,
          }),
          variant: 'error',
        });
      } else {
        console.error('Error updating user role:', err);
        showSnackbar({
          message: t('manageUsers.snackbar.roleUpdateFailed', {
            defaultValue: `Failed to update user role: ${err}`,
            error: err,
          }),
          variant: 'error',
        });
      }
    }
  };
  // --------------------------------------------------------------------------------------------------------------
  // Handle status change
  const handleStatusChange = async (
    userId: string,
    status: 'approved' | 'rejected' | 'deactivated' | 'active',
  ) => {
    let changedUser = users.find((u) => u.user_id === userId);
    try {
      await dispatch(updateUserStatus({ userId, status })).unwrap();
      // Find the user by ID to get their display name
      changedUser = users.find((u) => u.user_id === userId);
      const name = changedUser?.display_name ?? `User: ${userId}`;
      showSnackbar({
        message: `${name}'s status changed to ${STATUS_LABELS[status]}`,
        variant: 'info',
      });
      // Refresh the grid data without reloading the page
    } catch (err: unknown) {
      // Handle error
      if (err instanceof Error) {
        console.error('Error updating user status:', err.message);
        showSnackbar({
          message: t('manageUsers.snackbar.statusUpdateFailed', {
            defaultValue: `${changedUser?.display_name ?? `User ${userId}}`}: ${err.message
              }`,
          }),
          variant: 'error',
        });
      } else {
        console.error('Error updating user status:', err);
        showSnackbar({
          message: t('manageUsers.snackbar.statusUpdateFailed', {
            defaultValue: `Failed to update user status: ${err}`,
            error: err,
          }),
          variant: 'error',
        });
      }
    }
  };
  // Filter rows based on status tab
  // Here we can change what each tab shows
  const filtered = users.filter((u) => {
    if (filter === 'ALL') return true;
    // Lists pending users
    if (filter === 'PENDING') return u.user_status === 'pending';
    // Lists all active users(we need to figure out our database structure)
    if (filter === 'ACTIVE')
      return u.user_status === 'active' || u.user_status === 'approved';
    if (filter === 'DEACTIVATED') return u.user_status === 'deactivated';
    return true;
  });

  // Define columns for DataGrid
  const columns: GridColDef[] = [
    {
      field: 'display_name',
      headerName: 'Name',
      flex: 1,
      minWidth: 150,
      headerClassName: 'columnHeader',
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1,
      minWidth: 200,
      headerClassName: 'columnHeader',
    },

    {
      field: 'role_title',
      headerName: 'User role',
      headerClassName: 'columnHeader',
      flex: 1,
      minWidth: 180,
      renderCell: (params: GridRenderCellParams) => {
        const currentRole = (params.row.role_title ?? 'Unapproved') as
          | 'Unapproved'
          | 'User'
          | 'Admin'
          | 'Head Admin';

        // Head Admin: full control
        if (role === 'Head Admin') {
          return (
            <Select
              value={currentRole}
              size="small"
              type="button"
              fullWidth
              onChange={(e) => {
                handleRoleChange(
                  params.row.user_id,
                  e.target.value as 'User' | 'Admin' | 'Head Admin',
                );
              }}
              renderValue={(val) => val}
            >
              {/* Show “Unapproved” disabled option */}
              {currentRole === 'Unapproved' && (
                <MenuItem value="Unapproved" disabled>
                  Unapproved
                </MenuItem>
              )}
              {['User', 'Admin', 'Head Admin'].map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          );
        }

        // Admin: show a Select that always displays currentRole,
        // and only allows promoting Unapproved → User
        if (role === 'Admin') {
          // Build options: always include currentRole (disabled),
          // and if Unapproved, include 'User' as actionable.
          const options =
            currentRole === 'Unapproved'
              ? ['Unapproved', 'User']
              : [currentRole];
          return (
            <Select
              type="button"
              value={currentRole}
              size="small"
              sx={{ width: 150 }}
              disabled={currentRole !== 'Unapproved'}
              onChange={(e) => {
                handleRoleChange(
                  params.row.user_id,
                  e.target.value as 'User' | 'Admin' | 'Head Admin',
                );
              }}
            >
              {options.map((opt) => (
                <MenuItem key={opt} value={opt} disabled={opt === currentRole}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          );
        }
      },
    },

    {
      field: 'user_status',
      headerName: 'Status',
      headerClassName: 'columnHeader',
      flex: 1,
      minWidth: 160,
      renderCell: (params: GridRenderCellParams) => {
        const status = params.row
          .user_status as (typeof STATUS_OPTIONS)[number];
        // Only Admins and Head Admins can change status
        if (role === 'Admin' || role === 'Head Admin') {
          return (
            <Select
              type="button"
              value={status}
              size="small"
              sx={{ width: 150 }}
              onChange={(e) => {
                handleStatusChange(
                  params.row.user_id,
                  e.target.value as
                  | 'approved'
                  | 'rejected'
                  | 'deactivated'
                  | 'active',
                );
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {STATUS_LABELS[opt]}
                </MenuItem>
              ))}
            </Select>
          );
        }
        // other roles see text only
        return <Typography>{STATUS_LABELS[status]}</Typography>;
      },
    },
  ];

  return (
    <Container className="container" sx={{ mt: 6, mx: 'auto' }} maxWidth="lg">
      <Typography variant="heading_secondary_bold" gutterBottom>
        Manage Users
      </Typography>

      {/* Filter tabs */}
      <Tabs
        value={filter}
        onChange={handleTabChange}
        textColor="primary"
        indicatorColor="primary"
        sx={{ mb: 2 }}
      >
        <Tab value="ALL" label="All" />
        <Tab value="PENDING" label="Pending Approvals" />
        <Tab value="ACTIVE" label="Active" />
        <Tab value="DEACTIVATED" label="Deactivated" />
      </Tabs>

      {/* Data grid */}
      <Box sx={{ height: 500, width: '100%', mt: 2 }}>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <StyledDataGrid
            rows={filtered}
            getRowId={(row) => row.user_id}
            columns={columns}
            sx={{
              '& .columnHeader, .MuiDataGrid-scrollbarFiller ': {
                bgcolor: theme.palette.background.verylightgrey,
              },
            }}
            initialState={{
              pagination: { paginationModel: { pageSize: 10, page: 0 } },
            }}
            pageSizeOptions={[5, 10, 20]}
          />
        )}
      </Box>
    </Container>
  );
};

export default ManageUsers;
