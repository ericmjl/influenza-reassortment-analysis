import os

pkas = {
	'A':7.0,
	'R':12.48,
	'N':7.0,
	'D':3.90,
	'C':8.37,
	'E':4.70,
	'Q':7.0,
	'G':7.0,
	'H':6.04,
	'I':7.0,
	'L':7.0,
	'K':10.54,
	'M':7.0,
	'F':7.0,
	'P':7.0,
	'S':7.0,
	'T':7.0,
	'W':7.0,
	'Y':10.46,
	'V':7.0,
	'X':7.0,
	'-':7.0,
	'B':6.33, # B = asp or asn, average pka is 6.33
	'J':7.0 # J = leu or ile, pka is 7
}

mws = {
	'A':89.0935,
	'R':174.2017,
	'N':132.1184,
	'D':133.1032,
	'C':121.1590,
	'E':147.1299,
	'Q':146.1451,
	'G':75.0669,
	'H':155.1552,
	'I':131.1736,
	'J':131.1736,
	'L':131.1736,
	'K':146.1882,
	'M':149.2124,
	'F':165.1900,
	'P':115.1310,
	'S':105.0930,
	'T':119.1197,
	'W':204.2262,
	'Y':181.1894,
	'V':117.1469,
	'X':0,
	'-':0,
	'B':132.61395 #average weight of asp or asn
}

idxs = [f.split('_')[0] for f in os.listdir(os.getcwd())]

def alignment_as_dataframe(handle):
    sequences = [s for s in SeqIO.parse(handle, 'fasta')]
    alignment = pd.DataFrame(np.array([seq for seq in sequences]))
    idx = [seq.id for seq in sequences]
    alignment.index = idx
    
    return alignment

def make_biochemical_alignment(alignment, bioc_mapping_dict, bioc_str):
    bioc_alignment = alignment.copy()
    bioc_alignment.replace(bioc_mapping_dict.keys(), bioc_mapping_dict.values(), inplace=True)
    
#     print(bioc_alignment)
    
    num_distinct_bioc = []
    positions_only_one_bioc = []

    for column in bioc_alignment.columns:
        bioc_values = Counter(bioc_alignment[column].values)

        if len(bioc_values.keys()) == 1:
            positions_only_one_bioc.append(column)

        num_distinct_bioc.append(len(bioc_values.keys()))

    plt.plot(num_distinct_bioc)
    plt.title('Number of Distinct {0}'.format(bioc_str))
    plt.show()
    
    bioc_alignment_cleaned = bioc_alignment.copy()
    bioc_alignment_cleaned.drop(positions_only_one_bioc, axis=1, inplace=True)
    
    return bioc_alignment_cleaned

def perform_mds(bioc_correlation_matrix, bioc_str):
    from sklearn.manifold import MDS
    mds = MDS(dissimilarity='precomputed', n_jobs=-1)
    coords = mds.fit_transform(1 - bioc_correlation_matrix)
    
    coords_df = pd.DataFrame(coords)
    coords_df.index = bioc_correlation_matrix.index
    coords_df.columns = ['x', 'y']
    
    return coords_df

for idx in idxs[::-1]:

    alignment = alignment_as_dataframe('subgraph_ha_aligned/{0}_HA_Sequences_Aligned.fasta'.format(idx))
    pka_alignment = make_biochemical_alignment(alignment, pkas, 'pKas')
    mw_alignment = make_biochemical_alignment(alignment, mws, 'Molecular Weights')


    mds_coordinates_pka = perform_mds(pka_alignment.T.corr(), 'pKas')
    mds_coordinates_pka.to_csv('{0}_mds_pka_coordinates.csv')
    mds_coordinates_mw = perform_mds(mw_alignment.T.corr(), 'MWs')
    mds_coordinates_mw.to_csv('{0}_mds_mw_coordinates.csv')

    avg_alignment = (mw_alignment.T.corr() + pka_alignment.T.corr())/2 
    mds_coordinates_avg = perform_mds(avg_alignment, 'Average')
    mds_coordinates_avg.to_csv('{0}_mds_avg_coordinates.csv')


