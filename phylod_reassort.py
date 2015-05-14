
# coding: utf-8

# In[1]:

# Check what hosts are represented.
import networkx as nx
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from collections import Counter
from Bio import AlignIO, SeqIO
from itertools import combinations



print('Reading in network.')
G = nx.read_gpickle('20141103 All IRD Final Graph.pkl')

print('Setting reassortant status on nodes.')
for n, d in G.nodes(data=True):
    in_edge_types = set([d['edge_type'] for sc, sk, d in G.in_edges(n, data=True)])
    if 'reassortant' in in_edge_types:
        G.node[n]['reassortant'] = True
    elif 'full_complement' in in_edge_types:
        G.node[n]['reassortant'] = False
    else:
        G.node[n]['reassortant'] = False
        
def is_reassortant(G, node):
    return G.node[node]['reassortant']

print('Cleaning host species.')
host_species = []
for n, d in G.nodes(data=True):
    host = d['host_species']
    if '/' in host:
        host = host.split('/')[0]
    host_species.append(host.lower())
host_species = set(host_species)
# host_species


# In[2]:

# hosts_no18s = pd.DataFrame(list(host_species))
# hosts_no18s.to_csv('hosts_without_classification.csv')
# hosts_no18s.set_index(0, inplace=True)

print('Reading in host classification.')
hosts_18s = pd.read_csv('hosts_with_classification-NH_EM_mods.csv', index_col='Species')
# set(hosts_18s['Genbank ID']) 


# In[3]:

hosts_18s.fillna(0, inplace=True)


# In[4]:

# I have manually attached nearest available 18S rRNA sequence based on host species classification.
# Pending checks from Nichola. Meanwhile, nothing is stopping me from developing the code that will
# automate the downloading of 18S rRNA sequences based on the GenBank accessions grabbed.
# from Bio import Entrez, SeqIO
# Entrez.email = 'ericmjl@mit.edu'

# ribosomal_18s = []
# for gb_identifier in set(hosts_18s['Genbank ID']):
#     if isinstance(gb_identifier, str):
#         handle = Entrez.efetch(db='nucleotide', id=gb_identifier, rettype='fasta')
#         result = SeqIO.read(handle, 'fasta')
#         handle.close()
#         ribosomal_18s.append(result)
    
# SeqIO.write(ribosomal_18s, '18s_ribosomal_rna.fasta', 'fasta')


# In[5]:

# from Bio.Align.Applications import ClustalOmegaCommandline
# infile = '18s_ribosomal_rna.fasta'
# outfile = '18s_ribosomal_rna_aligned.fasta'

# cline = ClustalOmegaCommandline(infile=infile, outfile=outfile, verbose=True, force=True)
# print(cline)


# In[6]:

print('Reading in aligned 18S rRNA sequences.')
ribosomal_18s_aln = AlignIO.read('18s_ribosomal_rna_aligned.fasta', 'fasta')
ribosomal_18s_aln.get_alignment_length()


# In[7]:


# Plot the number of gaps by position
# num_gaps = []
# for pos in range(ribosomal_18s_aln.get_alignment_length()):
#     ntcounts = Counter(ribosomal_18s_aln[:,pos])
#     if '-' in ntcounts.keys():
#         num_gaps.append(ntcounts['-'])
#     else:
#         num_gaps.append(0)
        
# get_ipython().magic(u'matplotlib inline')
# plt.scatter(range(len(num_gaps)), num_gaps)
# plt.plot(num_gaps)


# In[8]:

# Because the sequence data alignments are:
# 1. non-overlapping
# 2. highly variable in length,
# I think the best way to define distance is as such:
# - Compare every position in the alignment.
# - Increment distance by 1 if and only if both positions are not gaps and are different.
# - Normalize distance by taking distance/len(smaller_18S)

# Read in the alignment but this time using SeqIO.
ribosome_sequences = SeqIO.parse('18s_ribosomal_rna_aligned.fasta', 'fasta')

accession_sequence = dict()
for s in ribosome_sequences:
    accession = s.id.split('|')[3]
    accession_sequence[accession] = s

    accession_sequence


# In[9]:

# for j in range(len(accession_sequence.keys())):
#     s1 = accession_sequence[accession_sequence.keys()[12]]
#     s2 = accession_sequence[accession_sequence.keys()[j]]

#     s1_ug = s1.seq.ungap('-')
#     s2_ug = s2.seq.ungap('-')

#     dist = 0
#     for i in range(len(s1)):
#         l1 = s1[i]
#         l2=  s2[i]

#         if l1 != '-' and l2 != '-' and l1 != l2:
#             dist += 1

    # print(dist / float(min([len(s1_ug), len(s2_ug)])))


# In[18]:

# hosts_18s[hosts_18s['Genbank ID'] == accession_sequence.keys()[19]]


# In[19]:

def clean_host_species(host_species):
    if '/' in host_species:
        host_species = host_species.split('/')[0]
        
    return host_species

def generate_random_polynucleotide(length):
    from random import choice
    from Bio.SeqRecord import SeqRecord
    from Bio.Seq import Seq
    """
    Need to change name of function.
    This produces not random polynucleotide, but a gapped sequence of specified length.
    """
    polynt = ''
    for i in range(length):
        polynt = polynt + '-'
    seqrec = SeqRecord(Seq(polynt))
    return seqrec

# Add in the 18S rRNA sequence to each node, if available.
for n, d in G.nodes(data=True):
    host_species = clean_host_species(d['host_species'])
    
    accession = hosts_18s.loc[host_species, 'Genbank ID']
    
    if accession in accession_sequence.keys():
        G.node[n]['18s_rRNA_sequence'] = accession_sequence[accession]
    else:
        G.node[n]['18s_rRNA_sequence'] = generate_random_polynucleotide(ribosomal_18s_aln.get_alignment_length())


# In[21]:

# G.node[n]['18s_rRNA_sequence']


# In[44]:

def compute_distance(seqrecord1, seqrecord2):
    smaller_length = min([len(seqrecord1.seq.ungap('-')), len(seqrecord2.seq.ungap('-'))])
    
    distance = 0
    for i in range(len(seqrecord1.seq)):
        l1 = seqrecord1.seq[i]
        l2 = seqrecord2.seq[i]
        
        if l1 != '-' and l2 != '-' and l1 != l2:
            distance += 1
            
    if smaller_length == 0:
        return 1
    else:
        return float(distance) / smaller_length

def host_phylogenetic_distance(G, n1, n2):
    """
    Compare two nodes' phylogenetic distance.
    """
    from Bio.SeqRecord import SeqRecord
    rrna_1 = G.node[n1]['18s_rRNA_sequence']
    rrna_2 = G.node[n2]['18s_rRNA_sequence']
    
    assert isinstance(rrna_1, SeqRecord), '{0} does not have a valid rRNA sequence.'.format(n1)
    assert isinstance(rrna_2, SeqRecord), '{0} does not have a valid rRNA sequence.'.format(n2)
    
    return compute_distance(rrna_1, rrna_2)


# In[62]:


# distances = []
# for s1, s2 in combinations(accession_sequence.values(), 2):
#     print(compute_distance(s1, s2),  s1.description, s2.description)
    # distances.append(compute_distance(s1,s2))
    
# plt.hist(distances, bins=100)
# plt.show()


# In[67]:

# G.edges(data=True)[0]


# In[46]:

# Compute distribution of phylo distances across reassortant vs. whole genome edges.
# Perform 2-sample KS test to see if they are different.
# Ignore the following:

def count_delta_phyloD(G):

    reassortant_phyloD = []
    full_complement_phyloD = []

    for sc, sk, d in G.edges(data=True):
        sc_18s = G.node[sc]['18s_rRNA_sequence'].seq.ungap('-')
        sk_18s = G.node[sk]['18s_rRNA_sequence'].seq.ungap('-')

        if len(sc_18s) != 0 and len(sk_18s) != 0:
            dist = host_phylogenetic_distance(G, sc, sk)
            if d['edge_type'] == 'reassortant':
                reassortant_phyloD.append(dist)

            elif d['edge_type'] == 'full_complement':
                full_complement_phyloD.append(dist)
                
    return reassortant_phyloD, full_complement_phyloD


# In[63]:
print('Computing phylogenetic distance metric.')
reassortant_phyloD, full_complement_phyloD = count_delta_phyloD(G)


# In[64]:

# len(reassortant_phyloD)


# In[65]:

# len(full_complement_phyloD)


# In[66]:

# plt.hist(reassortant_phyloD, color='blue', alpha=0.5, bins=100)
# plt.show()


# In[30]:

# plt.hist(full_complement_phyloD, color='green', alpha=0.5, bins=100)
# plt.xlim(0.4, 0.8)
# plt.show()


# In[31]:

from scipy.stats import ks_2samp

ks_2samp(sorted(reassortant_phyloD), full_complement_phyloD)
ks_2samp(sorted(full_complement_phyloD), reassortant_phyloD)


# In[33]:

# Define the "proportion non-identical" over all reassortant and full_complement edges. 

def proportion_nonidentical(list_of_phyloD_values):
    return 1 - float(Counter(list_of_phyloD_values)[0.0]) / sum(Counter(list_of_phyloD_values).values())
proportion_nonidentical(reassortant_phyloD)


# In[34]:

proportion_nonidentical(full_complement_phyloD)


# In[88]:
print('Computing ratio of proportion non-identical for reassortant divided by non-reassortant')
ratio = proportion_nonidentical(reassortant_phyloD)/proportion_nonidentical(full_complement_phyloD)
pd.DataFrame([ratio]).to_csv('ratio_identical_nonidentical.csv')


# 30 April 2015
# 
# Reassortment is more highly represented when there is a phylogenetic difference between the host species than when there isn't.
# 
# Phylogenetic difference is defined by the 18S rRNA. 
# 
# What if we used cytochrome C oxidase?

# In[78]:

def permute_18s(G):
    """
    Be sure to pass in a copy of G, and not the original!
    Takes in a graph G, shuffles the labels, and returns G with shuffled labels.
    """
    from random import shuffle
    rrna_labels = [d['18s_rRNA_sequence'] for n, d in G.nodes(data=True)]
    shuffle(rrna_labels)
    
    for i, n in enumerate(G.nodes()):
        G.node[n]['18s_rRNA_sequence'] = rrna_labels[i]
        
    return G

shuffledG = G.copy()

expected_reassort = []

from time import time

print('Running permutation experiment...')

data = np.zeros(shape=(100,10))

for i in range(100): # changed to 100 in script format.
    start_time = time()
    shuffledG = permute_18s(shuffledG)
    reassortant_shuffled_phyloD, full_complement_shuffled_phyloD = count_delta_phyloD(shuffledG)
    
    reassortant_shuffled_binned = np.histogram(reassortant_shuffled_phyloD, bins=bins)[0].astype(float)
    full_complement_shuffled_binned = np.histogram(full_complement_shuffled_phyloD, bins=bins)[0].astype(float)
    
    expected_proportion_reassortant = reassortant_shuffled_binned / (full_complement_shuffled_binned + reassortant_shuffled_binned)
    
    end_time = time()
    
    data[i] = expected_proportion_reassortant
    
    print('Round {0}, time: {1} s'.format(i, end_time - start_time))

# In[87]:

# pd.DataFrame(expected_reassort).to_csv('ratio_identical_nonidentical_expected.csv')
pd.DataFrame(data).fillna(0).to_csv('phylod_expected_reassortant_fraction.csv')

# In[37]:

# proportion_nonidentical(full_complement_shuffled_phyloD)


# In[73]:

# proportion_nonidentical(reassortant_shuffled_phyloD)/proportion_nonidentical(full_complement_shuffled_phyloD)


# In[72]:

# ks_2samp(reassortant_shuffled_phyloD, full_complement_shuffled_phyloD)


# In[38]:

# plt.hist(reassortant_shuffled_phyloD, bins=100)
# plt.show()


# In[39]:

# plt.hist(full_complement_shuffled_phyloD, bins=100)
# plt.show()


# In[ ]:



