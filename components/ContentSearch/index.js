import { TextControl, Spinner, NavigableMenu } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { useState, useRef, useEffect } from '@wordpress/element'; // eslint-disable-line
import PropTypes from 'prop-types';
import { __ } from '@wordpress/i18n';
import { jsx, css } from '@emotion/react';
import SearchItem from './SearchItem';
/** @jsx jsx */

const NAMESPACE = 'tenup-content-search';

const searchCache = {};

const ContentSearch = ({
	onSelectItem,
	placeholder,
	label,
	contentTypes,
	mode,
	excludeItems,
	perPage,
}) => {
	const [searchString, setSearchString] = useState('');
	const [searchResults, setSearchResults] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [selectedItem, setSelectedItem] = useState(null);
	const abortControllerRef = useRef();

	const mounted = useRef(true);

	/**
	 * handleSelection
	 *
	 * update the selected item in state to either the selected item or null if the
	 * selected item does not have a valid id
	 *
	 * @param {*} item
	 */
	function handleOnNavigate(item) {
		if (item === 0) {
			setSelectedItem(null);
		}

		setSelectedItem(item);
	}

	/**
	 * handleItemSelection
	 *
	 * reset the search input & item container
	 * trigger the onSelectItem callback passed in via props
	 *
	 * @param {*} item
	 */
	function handleItemSelection(item) {
		setSearchResults([]);
		setSearchString('');

		onSelectItem(item);
	}

	function filterResults(results) {
		return results.filter((result) => {
			let keep = true;

			if (excludeItems.length) {
				keep = excludeItems.every((item) => item.id !== result.id);
			}

			return keep;
		});
	}

	const hasSearchString = !!searchString.length;
	const hasSearchResults = !!searchResults.length;

	/**
	 * Depending on the mode value, this method normalizes the format
	 * of the result array.
	 *
	 * @param {string} mode ContentPicker mode.
	 * @param {Array} result The array to be normalized.
	 * @returns {Array} The normalizes array.
	 */
	const normalizeResults = (mode = 'post', result = []) => {
		if (mode === 'user') {
			return result.map((item) => {
				return {
					id: item.id,
					subtype: mode,
					title: item.name,
					type: mode,
					url: item.link,
				};
			});
		}

		return result;
	};

	/**
	 * handleSearchStringChange
	 *
	 * Using the keyword and the list of tags that are linked to the parent block
	 * search for posts/terms that match and return them to the autocomplete component.
	 *
	 * @param {string} keyword search query string
	 */
	const handleSearchStringChange = (keyword) => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		setSearchString(keyword);

		if (keyword.trim() === '') {
			setIsLoading(false);
			setSearchResults([]);
			abortControllerRef.current = null;
			return;
		}

		abortControllerRef.current = new AbortController();

		setIsLoading(true);

		let searchQuery;

		switch (mode) {
			case 'user':
				searchQuery = `wp/v2/users/?search=${keyword}`;
				break;
			default:
				searchQuery = `wp/v2/search/?search=${keyword}&subtype=${contentTypes.join(
					',',
				)}&type=${mode}&_embed&per_page=${perPage}`;
				break;
		}

		if (searchCache[searchQuery]) {
			abortControllerRef.current = null;

			setSearchResults(filterResults(searchCache[searchQuery]));
			setIsLoading(false);
		} else {
			apiFetch({
				path: searchQuery,
				signal: abortControllerRef.current.signal,
			})
				.then((results) => {
					if (mounted.current === false) {
						return;
					}

					abortControllerRef.current = null;

					const normalizedResults = normalizeResults(mode, results);
					searchCache[searchQuery] = normalizedResults;

					setSearchResults(filterResults(normalizedResults));

					setIsLoading(false);
				})
				.catch((error, code) => {
					// fetch_error means the request was aborted
					if (error.code !== 'fetch_error') {
						setSearchResults([]);
						abortControllerRef.current = null;
						setIsLoading(false);
					}
				});
		}
	};

	useEffect(() => {
		return () => {
			mounted.current = false;
		};
	}, []);

	const listCSS = css`
		/* stylelint-disable */
		max-height: 350px;
		overflow-y: auto;
	`;

	return (
		<NavigableMenu onNavigate={handleOnNavigate} orientation="vertical">
			<TextControl
				label={label}
				value={searchString}
				onChange={handleSearchStringChange}
				placeholder={placeholder}
				autoComplete="off"
			/>
			{hasSearchString ? (
				<ul
					className={`${NAMESPACE}-list`}
					style={{
						marginTop: '0',
						marginBottom: '0',
						marginLeft: '0',
						paddingLeft: '0',
						listStyle: 'none',
					}}
					css={listCSS}
				>
					{isLoading && <Spinner />}
					{!isLoading && !hasSearchResults && (
						<li
							className={`${NAMESPACE}-list-item components-button`}
							style={{ color: 'inherit', cursor: 'default', paddingLeft: '3px' }}
						>
							{__('Nothing found.', '10up-block-components')}
						</li>
					)}
					{!isLoading &&
						searchResults.map((item, index) => {
							if (!item.title.length) {
								return null;
							}

							return (
								<li
									key={item.id}
									className={`${NAMESPACE}-list-item`}
									style={{
										marginBottom: '0',
									}}
								>
									<SearchItem
										onClick={() => handleItemSelection(item)}
										searchTerm={searchString}
										suggestion={item}
										contentTypes={contentTypes}
										isSelected={selectedItem === index + 1}
									/>
								</li>
							);
						})}
				</ul>
			) : null}
		</NavigableMenu>
	);
};

ContentSearch.defaultProps = {
	contentTypes: ['post', 'page'],
	placeholder: '',
	perPage: 50,
	label: '',
	excludeItems: [],
	mode: 'post',
	onSelectItem: () => {
		console.log('Select!'); // eslint-disable-line no-console
	},
};

ContentSearch.propTypes = {
	contentTypes: PropTypes.array,
	mode: PropTypes.string,
	onSelectItem: PropTypes.func,
	placeholder: PropTypes.string,
	excludeItems: PropTypes.array,
	label: PropTypes.string,
	perPage: PropTypes.number,
};

export { ContentSearch };
