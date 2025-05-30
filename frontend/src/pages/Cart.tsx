import {
	Box,
	Button,
	ButtonGroup,
	CardMedia,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Typography,
	Link as MUILink
} from '@mui/material';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
	addItemToCart,
	emptyCart,
	removeItemFromCart,
	selectCart,
	selectDateRange,
	setCartItems,
} from '../slices/cartSlice';
import InfoOutlineIcon from '@mui/icons-material/InfoOutline';
import { addBooking, fetchUserBookings } from '../slices/bookingsSlice';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { store } from '../store/store';
import { checkAvailabilityForItemOnDates } from '../selectors/availabilitySelector';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { DateValue, getLocalTimeZone, parseDate, today } from '@internationalized/date';
import { RangeValue } from '@react-types/shared';
import { DateRangePicker, defaultTheme, Provider } from '@adobe/react-spectrum';
import { ItemWithQuantity } from '../types/types';
import broken_img from '../assets/broken_img.png'
import { fetchFutureReservations } from '../slices/reservationsSlice';
import { useTranslatedSnackbar } from '../components/CustomComponents/TranslatedSnackbar/TranslatedSnackbar';


function Cart() {
	const dispatch = useAppDispatch();
	const { cart } = useAppSelector(selectCart);
	const { user, role } = useAuth();
	const selectedDateRange = useAppSelector(selectDateRange);
	const [editingCart, setEditingCart] = useState(false);
	const [localCartRange, setLocalCartRange] = useState<RangeValue<DateValue> | null>(null);
	const now = today(getLocalTimeZone());
	const [qtyCheckErrors] = useState<Record<string, string>>({});
	const [incorrectCart, setIncorrectCart] = useState(false);
	const [localCart, setLocalCart] = useState<ItemWithQuantity[]>([]);
	const navigate = useNavigate()
	const { t } = useTranslation();
	const { showSnackbar } = useTranslatedSnackbar()

	const updateRangeWithSelectedRange = useCallback(() => {
		if (selectedDateRange.start_date && selectedDateRange.end_date) {
			setLocalCartRange({
				start: parseDate(selectedDateRange.start_date),
				end: parseDate(selectedDateRange.end_date),
			});
			// move to range in the DatePickjer
		} else {
			setLocalCartRange(null);
		}
	}, [selectedDateRange])
	useEffect(() => {
		updateRangeWithSelectedRange(); // These need to be changed around. Your calling on something that is not set yet.
	}, [updateRangeWithSelectedRange]);

	useEffect(() => {
		updateLocalCartWithCart();
	}, [cart])


	const updateLocalCartWithCart = () => {
		setLocalCart(cart.map(item => ({ ...item })));
		// fills local cart with cart from redux
	}

	// Calculate total quantity of all cart items
	const totalItems = cart.reduce(
		(total, item) => total + (item.quantity || 0),
		0,
	);

	const createBookingFromCart = () => {
		const itemsForBooking = cart.map((item) => {
			const { start_date, end_date } = selectedDateRange;
			return {
				item_id: item.item_id,
				start_date: start_date,
				end_date: end_date,
				quantity: item.quantity,
			};
		});
		return { user_id: user?.id, items: itemsForBooking };
	};

	const handleStartDateEdit = () => {
		setEditingCart(true);
	}

	const handleCancelDateEdit = () => {
		updateRangeWithSelectedRange();
		updateLocalCartWithCart();
		setIncorrectCart(false);
		setEditingCart(false);
		// need to revert the changes of the items to initial state, using selected date and cart from redux
	}

	const handleCompleteDateEdit = () => {
		if (incorrectCart) {
			showSnackbar({ message: 'Update the cart so no mistakes', variant: 'warning' });
		} else {
			if (localCartRange) {
				dispatch(setCartItems({ newStartDate: localCartRange.start.toString(), newEndDate: localCartRange.end.toString(), cart: localCart.filter(item => item.quantity > 0) }));
				showSnackbar({ message: t('cart.snackbar.cartUpdated', { defaultValue: 'Your cart was updated!' }), variant: 'info' });
				setEditingCart(false);
			}
		}
	}

	const checkLocalCartForDates = (newRange: RangeValue<DateValue> | null = localCartRange) => {

		Object.keys(qtyCheckErrors).forEach(key => {
			delete qtyCheckErrors[key];
		}); // emtying the errors array*/

		if (newRange) {
			localCart.forEach(item => {
				const availabilityCheck = checkAvailabilityForItemOnDates(
					item.item_id,
					item.quantity, // is not updated fast enough
					newRange.start.toString(),
					newRange.end.toString(),
					false
				)(store.getState());

				if (availabilityCheck.severity != 'success') {
					qtyCheckErrors[item.item_id] = availabilityCheck.message;
				}
				// finish the check - if there is no success ,then there is a error
			});
			setIncorrectCart(Object.keys(qtyCheckErrors).length !== 0);

		}
	}

	const handleDateChange = (newRange: RangeValue<DateValue> | null) => {
		if (newRange) {
			const startDate = new Date(newRange.start.toString());
			const endDate = new Date(newRange.end.toString());
			const diffInMs = endDate.getTime() - startDate.getTime();
			const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

			if (diffInDays > 14) {
				showSnackbar({ message: t('booking.snackbar.maxDays', { defaultValue: 'You can only book a maximum of 14 days' }), variant: 'warning' });
				return;
			}
			setLocalCartRange(newRange);
			checkLocalCartForDates(newRange);
		}
	};

	const handleRemove = (item_id: string, quantity: number = 1) => {
		if (editingCart) {
			setLocalCart(localCart.map(item => {
				if (item.item_id == item_id) {
					if (item.quantity - quantity >= 0) {
						item.quantity -= quantity;
					}
				}
				return item;
			}))
			checkLocalCartForDates();
			// if the cart is being edited, the changes reflect only in local cart, not touching redux
		} else {
			dispatch(removeItemFromCart({
				item_id: item_id,
				quantityToRemove: quantity
			}));
		}
	}

	const handleIncrease = (item_id: string, quantity: number = 1) => {
		if (localCartRange) {
			const start_date = localCartRange.start.toString();
			const end_date = localCartRange.end.toString();
			const qtyInLocalCart = localCart.find(item => item.item_id === item_id)?.quantity ?? 0;

			const checkAdditionToCart = checkAvailabilityForItemOnDates(
				item_id,
				qtyInLocalCart + quantity, // only takes into account quantity in redux cart
				start_date,
				end_date,
				false,
			)(store.getState());
			// checks if item can be added to cart
			if (checkAdditionToCart.severity === 'success') {
				if (editingCart) {
					setLocalCart(localCart.map(item => {
						if (item.item_id == item_id) {
							item.quantity += quantity;
						}
						return item;
					}))
					// if the cart is being edited, then only added to local cart
				} else {
					dispatch(
						addItemToCart({
							item: cart.find((itemInCart) => itemInCart.item_id === item_id),
							quantity: quantity,
							start_date: start_date,
							end_date: end_date,
						}),
					);
				}
				showSnackbar({ message: t('cart.snackbar.itemAdded', { defaultValue: 'Item was added to cart!' }), variant: 'info' });
				// adds the item in case it is available

			} else {
				showSnackbar({
					message: checkAdditionToCart.message,
					variant: checkAdditionToCart.severity,
				});
			}
		}
	};

	const handleBrokenImg = (
		e: React.SyntheticEvent<HTMLImageElement, Event>,
	) => {
		(e.target as HTMLImageElement).src = broken_img;
	};

	const handleAddBooking = async () => {
		const newBookingData: object = createBookingFromCart();
		const resultAction = await dispatch(addBooking(newBookingData));
		if (!user) {
			showSnackbar({ message: t('cart.snackbar.register', { defaultValue: "Only registered users can make a booking" }), variant: 'error' });
			return;
		}
		if (addBooking.rejected.match(resultAction)) {
			showSnackbar({ message: t('cart.snackbar.createBookingError', { defaultValue: 'Something went wrong when creating your booking. If the problem persists, contact us' }), variant: 'error' });
		} else {
			showSnackbar({ message: t('cart.snackbar.bookingCreated', { defaultValue: 'Your booking has been created!' }), variant: 'info' });
			dispatch(emptyCart());
			dispatch(fetchUserBookings(user.id));
			dispatch(fetchFutureReservations());
			// update future reservations

			// Navigate to new booking
			navigate(`/bookings/${resultAction.payload.booking.booking_id}`)
		}
	};

	return (
		<Box
			sx={{
				maxWidth: 1240,
				m: '0 auto',
				px: 2,
			}}
		>
			<Typography variant="heading_secondary_bold">{t('cart.yourCart', { defaultValue: 'Your Cart' })}</Typography>

			{cart.length > 0 ? (
				<Stack
					sx={{
						gap: '32px',
						flexWrap: 'wrap',
						flexDirection: {
							xs: 'column',
							md: 'row',
						},
					}}
				>
					<TableContainer sx={{ maxWidth: 816, flex: 1, minWidth: 360 }}>
						<Table aria-label="simple table">
							<TableHead>
								<TableRow>
									<TableCell>{t('cart.items', { defaultValue: 'Items' })} ({totalItems})</TableCell>
									<TableCell align="center">{t('cart.quantity', { defaultValue: 'Qty' })}</TableCell>
									<TableCell align="right">{t('cart.action', { defaultValue: 'Action' })}</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{localCart.map((item) => (
									<TableRow
										key={item.item_id}
										sx={{
											'&:last-child td, &:last-child th': { border: 0 },
											'& > td': { minHeight: 127.64 },
											minHeight: 127.64,
										}}
									>
										<TableCell>
											<MUILink href={`/items/${item.item_id}`} sx={{ textDecoration: 'none' }}>
												<Stack direction={'row'} sx={{ gap: '21px' }}>
													<CardMedia
														component="img"
														image={
															item.image_path[0] || broken_img
														}
														onError={handleBrokenImg}
														style={{ width: 78, borderRadius: 14 }}
													/>
													<Stack sx={{ maxWidth: 186 }}>
														<Typography>{item.item_name}</Typography>
														{incorrectCart &&
															<Typography color="error">{qtyCheckErrors[item.item_id]}</Typography>
														}
													</Stack>
												</Stack>
											</MUILink>
										</TableCell>
										<TableCell align="center">
											<ButtonGroup
												sx={{ height: '40px' }}
												disableElevation
												variant="contained"
												aria-label="Disabled button group"
											>
												<Button
													onClick={() => {
														handleRemove(item.item_id);
													}}
													variant="outlined"
													sx={{
														borderRadius: '60px',
														borderTop: '1px solid #E2E2E2 !important',
														borderLeft: '1px solid #E2E2E2 !important',
														borderBottom: '1px solid #E2E2E2 !important',
														borderRight: '0px !important',
													}}
												>
													<RemoveIcon />
												</Button>
												<Box
													sx={{
														width: 20,
														textAlign: 'center',
														borderTop: '1px solid #E2E2E2',
														borderBottom: '1px solid #E2E2E2',
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														px: 2,
													}}
												>
													<Typography
														variant="body1"
														sx={{ height: 'fit-content', lineHeight: 1 }}
													>
														{item.quantity}
													</Typography>
												</Box>
												<Button
													variant="outlined"
													onClick={() => {
														handleIncrease(item.item_id);
													}}
													sx={{
														borderRadius: '60px',
														borderTop: '1px solid #E2E2E2 !important',
														borderRight: '1px solid #E2E2E2 !important',
														borderBottom: '1px solid #E2E2E2 !important',
														borderLeft: '0px',
													}}
												>
													<AddIcon />
												</Button>
											</ButtonGroup>
										</TableCell>
										<TableCell align="right" sx={{ pr: 0 }}>
											<Button
												sx={{ gap: '6px' }}
												variant="outlined_rounded"
												onClick={() => {
													handleRemove(item.item_id, item.quantity);
												}}
											>
												{t('cart.remove', { defaultValue: 'Remove' })}
												<CloseIcon sx={{ fill: '#414141' }} />
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>

					{/* Booking Summary */}
					<Stack
						id="booking_summary"
						sx={{
							border: '1px solid #E2E2E2',
							padding: '40px 30px',
							maxWidth: {
								xs: 'auto',
								md: 392,
							},
							flex: 1,
							gap: '24px',
							height: 'fit-content',
							minWidth: 290,
						}}
					>
						<Typography
							variant="body3"
							sx={{
								fontSize: 22,
								borderLeft: '2px solid black',
								color: 'text.primary',
								pl: 2,
								fontWeight: 500,
							}}
						>
							{t('cart.bookingSummary', { defaultValue: 'Booking Summary' })}
						</Typography>
						<Stack direction={'row'} justifyContent={'space-between'}>
							<Typography variant="body2">{t('cart.dates', { defaultValue: 'Dates' })}</Typography>
							{!editingCart ?
								<Typography variant="body2">
									{selectedDateRange.start_date} - {selectedDateRange.end_date}
								</Typography>
								: <Provider theme={defaultTheme} colorScheme="light" maxWidth={270}>
									<DateRangePicker
										labelPosition="side"
										labelAlign="end"
										width={270}
										aria-label="Select dates"
										value={localCartRange}
										minValue={now}
										onChange={handleDateChange}
										isRequired
										maxVisibleMonths={1}
									/>
								</Provider>}
						</Stack>
						<Stack direction={'row'} justifyContent={'right'} spacing={1}>
							{!editingCart ?
								<Button
									variant="text"
									color="primary"
									sx={{
										textDecoration: 'underline',
										textTransform: 'none', // Keep original casing
										padding: 0, // Remove extra space
										minWidth: 0, // Optional: tighter layout
										fontWeight: 'normal', // Optional: make it look like regular link text
									}}
									onClick={handleStartDateEdit}
								>
									{t('cart.changeDates', { defaultValue: 'Change the booking dates' })}
								</Button>
								:
								<>
									<Button
										variant="text"
										color="primary"
										sx={{
											textDecoration: 'underline',
											textTransform: 'none', // Keep original casing
											padding: 0, // Remove extra space
											minWidth: 0, // Optional: tighter layout
											fontWeight: 'normal', // Optional: make it look like regular link text
										}}
										onClick={handleCompleteDateEdit}
									>
										{t('cart.confirmDates', { defaultValue: 'Confirm new dates' })}
									</Button>

									<Button
										variant="text"
										color="primary"
										sx={{
											textDecoration: 'underline',
											textTransform: 'none', // Keep original casing
											padding: 0, // Remove extra space
											minWidth: 0, // Optional: tighter layout
											fontWeight: 'normal', // Optional: make it look like regular link text
										}}
										onClick={handleCancelDateEdit}
									>
										{t('cart.cancel', { defaultValue: 'Cancel' })}
									</Button>
								</>
							}
						</Stack>
						<Stack direction={'row'} justifyContent={'space-between'}>
							<Typography variant="body2">{t('cart.totalItems', { defaultValue: 'Total items' })}</Typography>
							<Typography variant="body2">{totalItems}</Typography>
						</Stack>
						{!user && <Stack sx={{ border: '1px solid #E2E2E2', flexDirection: 'row', padding: '20px 24px', gap: '10px' }}>
							<InfoOutlineIcon />
							<Typography variant='body1'>{t('cart.bookItemsLogInInfo', { defaultValue: 'Log in to book items' })}</Typography>
						</Stack>}
						{role === 'Unapproved' && <Stack sx={{ border: '1px solid #E2E2E2', flexDirection: 'row', padding: '20px 24px', gap: '10px' }}>
							<InfoOutlineIcon />
							<Typography variant='body1'>{t('cart.bookItemsApprovalInfo', { defaultValue: 'Your account is awaiting approval. Once approved, you may create a booking!' })}</Typography>
						</Stack>}
						<Button
							sx={{
								width: { xs: 'fit-content', md: '100%' },
								mx: 'auto',
								px: 10,
							}}
							variant="rounded"
							size="small"
							onClick={handleAddBooking}
							disabled={(editingCart || role === 'Unapproved')}
						>
							{t('cart.bookItems', { defaultValue: 'Book items' })}
						</Button>
					</Stack>
				</Stack>
			) : (
				<Typography>
					<Trans
						i18nKey="cart.empty"
						defaultValue="Your cart is currently empty! Browse Items"
					>
						Your cart is currently empty! <Link to="/items">Browse Items</Link>
					</Trans>
				</Typography>
			)}
		</Box>
	);
}

export default Cart;
